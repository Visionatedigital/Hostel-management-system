import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const maintSelect = `
  SELECT m.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name
  FROM maintenance_requests m
  LEFT JOIN residents r ON r.id = m.resident_id
  LEFT JOIN rooms rm ON rm.id = m.room_id
`;

function getResidentId(user) {
  if (user.role !== 'resident') return null;
  return db.prepare('SELECT resident_id FROM users WHERE id = ?').get(user.id)?.resident_id || null;
}

// List: residents see only their own; admin sees all. Security has no access.
router.get('/', (req, res) => {
  if (req.user.role === 'security') return res.status(403).json({ error: 'Insufficient permissions' });
  const { status, priority, category } = req.query;
  let sql = maintSelect + ' WHERE 1=1';
  const params = [];
  if (req.user.role === 'resident') {
    sql += ' AND m.resident_id = ?';
    params.push(getResidentId(req.user));
  }
  if (status) { sql += ' AND m.status = ?'; params.push(status); }
  if (priority) { sql += ' AND m.priority = ?'; params.push(priority); }
  if (category) { sql += ' AND m.category = ?'; params.push(category); }
  sql += ' ORDER BY m.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Resident reports an incident; admin/security can also log one
router.post('/', (req, res) => {
  const { resident_id, room_id, category, description, priority, assigned_to } = req.body || {};
  if (!description) return res.status(400).json({ error: 'Description required' });

  let rid = resident_id || null;
  let rmId = room_id || null;

  // Residents report against their own record and room automatically
  if (req.user.role === 'resident') {
    rid = getResidentId(req.user);
    const resident = db.prepare('SELECT room_id FROM residents WHERE id = ?').get(rid);
    rmId = resident?.room_id || null;
  }

  const info = db.prepare(
    `INSERT INTO maintenance_requests (resident_id, room_id, category, description, priority, status, assigned_to)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(rid, rmId, category || null, description, priority || 'normal', assigned_to || null);
  res.status(201).json(db.prepare(maintSelect + ' WHERE m.id = ?').get(info.lastInsertRowid));
});

// Admin/security update (assign trade/person, advance status)
router.put('/:id', requireRole('admin', 'security'), (req, res) => {
  const m = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Request not found' });
  const { resident_id, room_id, category, description, priority, status, assigned_to } = req.body || {};
  db.prepare(
    `UPDATE maintenance_requests SET resident_id = ?, room_id = ?, category = ?, description = ?,
       priority = ?, status = ?, assigned_to = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(resident_id ?? m.resident_id, room_id ?? m.room_id, category ?? m.category,
        description ?? m.description, priority ?? m.priority, status ?? m.status,
        assigned_to ?? m.assigned_to, m.id);
  res.json(db.prepare(maintSelect + ' WHERE m.id = ?').get(m.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const m = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Request not found' });
  db.prepare('DELETE FROM maintenance_requests WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

export default router;
