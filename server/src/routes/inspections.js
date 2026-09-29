import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const inspSelect = `
  SELECT i.*, rm.name AS room_name, r.first_name AS resident_first, r.last_name AS resident_last
  FROM inspections i
  LEFT JOIN rooms rm ON rm.id = i.room_id
  LEFT JOIN residents r ON r.id = i.resident_id
`;

router.get('/', requireRole('admin'), (req, res) => {
  res.json(db.prepare(inspSelect + ' ORDER BY i.inspection_date DESC').all());
});

router.post('/', requireRole('admin'), (req, res) => {
  const { room_id, resident_id, inspection_date, condition_notes, returned_keys, deductions_proposed, deposit_status } = req.body || {};
  const info = db.prepare(
    `INSERT INTO inspections (room_id, resident_id, inspection_date, condition_notes, returned_keys, deductions_proposed, deposit_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(room_id || null, resident_id || null, inspection_date || null, condition_notes || null,
        returned_keys ? 1 : 0, deductions_proposed || 0, deposit_status || 'pending');
  res.status(201).json(db.prepare(inspSelect + ' WHERE i.id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const i = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Inspection not found' });
  const { room_id, resident_id, inspection_date, condition_notes, returned_keys, deductions_proposed, deposit_status } = req.body || {};
  db.prepare(
    `UPDATE inspections SET room_id = ?, resident_id = ?, inspection_date = ?, condition_notes = ?,
       returned_keys = ?, deductions_proposed = ?, deposit_status = ? WHERE id = ?`
  ).run(room_id ?? i.room_id, resident_id ?? i.resident_id, inspection_date ?? i.inspection_date,
        condition_notes ?? i.condition_notes, returned_keys ?? i.returned_keys,
        deductions_proposed ?? i.deductions_proposed, deposit_status ?? i.deposit_status, i.id);
  res.json(db.prepare(inspSelect + ' WHERE i.id = ?').get(i.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const i = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Inspection not found' });
  db.prepare('DELETE FROM inspections WHERE id = ?').run(i.id);
  res.json({ ok: true });
});

export default router;
