import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import { getSettings } from '../settings.js';

const router = Router();

const paymentSelect = `
  SELECT p.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name,
    sc.visitor_id AS sleepover_visitor_id, sc.nights AS sleepover_nights,
    sc.start_date AS sleepover_start_date, sc.end_date AS sleepover_end_date,
    sc.requested_method AS sleepover_requested_method
  FROM payments p
  LEFT JOIN residents r ON r.id = p.resident_id
  LEFT JOIN rooms rm ON rm.id = p.room_id
  LEFT JOIN sleepover_charges sc ON sc.payment_id = p.id
`;

function getResidentId(user) {
  if (user.role !== 'resident') return null;
  return db.prepare('SELECT resident_id FROM users WHERE id = ?').get(user.id)?.resident_id || null;
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

router.get('/sleepovers/rate', requireRole('resident'), (_req, res) => {
  res.json({ nightly_rate: getSettings().sleepover_nightly_rate, currency: 'UGX', max_nights: 14 });
});

router.post('/sleepovers', requireRole('resident'), (req, res) => {
  const residentId = getResidentId(req.user);
  if (!residentId) return res.status(403).json({ error: 'Your account is not linked to a resident record.' });
  const { visitor_id, start_date, nights, method } = req.body || {};
  const visitorId = Number(visitor_id);
  const nightCount = Number(nights);
  const start = dateOnly(start_date);
  if (!Number.isSafeInteger(visitorId) || visitorId <= 0 || !Number.isSafeInteger(nightCount) || nightCount < 1 || nightCount > 14 || !start || !['mtn_momo', 'airtel_money', 'card', 'cash'].includes(method)) {
    return res.status(400).json({ error: 'Choose a guest, a valid start date, 1–14 nights and a payment method.' });
  }
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ? AND resident_id = ?').get(visitorId, residentId);
  if (!visitor) return res.status(404).json({ error: 'Guest invitation not found.' });
  if (['declined', 'cancelled', 'expired', 'checked_out'].includes(visitor.status)) return res.status(409).json({ error: 'This guest invitation is no longer active.' });
  if (db.prepare('SELECT 1 FROM sleepover_charges WHERE visitor_id = ?').get(visitorId)) return res.status(409).json({ error: 'A sleepover charge already exists for this guest invitation.' });
  const rate = getSettings().sleepover_nightly_rate;
  if (!Number.isSafeInteger(rate) || rate <= 0) return res.status(409).json({ error: 'Management must set a nightly sleepover rate first.' });
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + nightCount);
  const endDate = end.toISOString().slice(0, 10);
  const amount = rate * nightCount;
  const description = `Guest sleepover: ${visitor.guest_name} · ${nightCount} night${nightCount === 1 ? '' : 's'} (${start_date} to ${endDate})`;
  try {
    const paymentId = db.transaction(() => {
      const payment = db.prepare(`INSERT INTO payments (resident_id, amount, type, status, method, due_date, description)
        VALUES (?, ?, 'other', 'pending', ?, ?, ?)`).run(residentId, amount, method === 'card' ? 'other' : method, start_date, description);
      db.prepare(`INSERT INTO sleepover_charges (visitor_id, payment_id, start_date, end_date, nights, nightly_rate, requested_method)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(visitorId, payment.lastInsertRowid, start_date, endDate, nightCount, rate, method);
      return payment.lastInsertRowid;
    })();
    res.status(201).json(db.prepare(paymentSelect + ' WHERE p.id = ?').get(paymentId));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A sleepover charge already exists for this guest invitation.' });
    throw error;
  }
});

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

  if (db.prepare('SELECT 1 FROM sleepover_charges WHERE payment_id = ?').get(p.id)) return res.status(409).json({ error: 'Sleepover payments require staff confirmation or a connected payment provider.' });

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
  if (db.prepare('SELECT 1 FROM sleepover_charges WHERE payment_id = ?').get(p.id) && Object.keys(req.body || {}).some(key => key !== 'status' && key !== 'reference')) return res.status(400).json({ error: 'Sleepover charges are fixed at the booked rate. Change only status or reference.' });
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
  if (db.prepare('SELECT 1 FROM sleepover_charges WHERE payment_id = ?').get(p.id)) return res.status(409).json({ error: 'Sleepover charges cannot be deleted.' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

export default router;
