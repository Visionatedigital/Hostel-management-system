import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const paymentSelect = `
  SELECT p.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name
  FROM payments p
  LEFT JOIN residents r ON r.id = p.resident_id
  LEFT JOIN rooms rm ON rm.id = p.room_id
`;

function getResidentId(user) {
  if (user.role !== 'resident') return null;
  return db.prepare('SELECT resident_id FROM users WHERE id = ?').get(user.id)?.resident_id || null;
}

router.get('/', (req, res) => {
  if (req.user.role === 'security') return res.status(403).json({ error: 'Insufficient permissions' });
  const { status } = req.query;
  let sql = paymentSelect + ' WHERE 1=1';
  const params = [];
  if (req.user.role === 'resident') {
    sql += ' AND p.resident_id = ?';
    params.push(getResidentId(req.user));
  }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', requireRole('admin'), (req, res) => {
  const byStatus = db.prepare(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM payments GROUP BY status`
  ).all();
  const totalOutstanding = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('pending','failed')`
  ).get();
  const totalCollected = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'paid'`
  ).get();
  res.json({ by_status: byStatus, total_outstanding: totalOutstanding.total, total_collected: totalCollected.total });
});

// Resident's own balance summary
router.get('/mine/summary', (req, res) => {
  if (req.user.role !== 'resident') {
    return res.status(403).json({ error: 'Resident only' });
  }
  const rid = getResidentId(req.user);
  const outstanding = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE resident_id = ? AND status IN ('pending','failed')`
  ).get(rid);
  const paid = db.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE resident_id = ? AND status = 'paid'`
  ).get(rid);
  res.json({ outstanding: outstanding.total, paid: paid.total });
});

// Admin/security create an invoice
router.post('/', requireRole('admin', 'security'), (req, res) => {
  const { resident_id, amount, type, status, method, reference, due_date, description } = req.body || {};
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  const info = db.prepare(
    `INSERT INTO payments (resident_id, amount, type, status, method, reference, due_date, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(resident_id || null, amount, type || 'rent', status || 'pending', method || null,
        reference || null, due_date || null, description || null);
  res.status(201).json(db.prepare(paymentSelect + ' WHERE p.id = ?').get(info.lastInsertRowid));
});

// Resident pays an invoice (simulated mobile money until a provider is connected)
router.post('/:id/pay', (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  if (req.user.role === 'resident') {
    const rid = getResidentId(req.user);
    if (rid !== p.resident_id) return res.status(403).json({ error: 'Not your invoice' });
  }

  if (p.status === 'paid') return res.status(409).json({ error: 'Already paid' });

  const { method } = req.body || {};
  const m = method || 'mtn_momo';
  const ref = (m === 'airtel_money' ? 'AM-' : 'MM-') + Math.floor(100000 + Math.random() * 900000);
  const paidAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(
    `UPDATE payments SET status = 'paid', method = ?, reference = ?, paid_at = ? WHERE id = ?`
  ).run(m, ref, paidAt, p.id);

  res.json({ ...db.prepare(paymentSelect + ' WHERE p.id = ?').get(p.id), simulated: true });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  const { resident_id, amount, type, status, method, reference, due_date, description } = req.body || {};
  const newStatus = status ?? p.status;
  const paid_at = newStatus === 'paid' && !p.paid_at
    ? new Date().toISOString().replace('T', ' ').slice(0, 19)
    : p.paid_at;
  db.prepare(
    `UPDATE payments SET resident_id = ?, amount = ?, type = ?, status = ?, method = ?, reference = ?,
       due_date = ?, description = ?, paid_at = ? WHERE id = ?`
  ).run(resident_id ?? p.resident_id, amount ?? p.amount, type ?? p.type, newStatus,
        method ?? p.method, reference ?? p.reference, due_date ?? p.due_date,
        description ?? p.description, paid_at, p.id);
  res.json(db.prepare(paymentSelect + ' WHERE p.id = ?').get(p.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

export default router;
