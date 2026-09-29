import { Router } from 'express';
import db from '../db.js';

const router = Router();

const residentSelect = `
  SELECT r.*, rm.name AS room_name, rm.type AS room_type
  FROM residents r LEFT JOIN rooms rm ON rm.id = r.room_id
`;

router.get('/', (req, res) => {
  const { status, room_id, q } = req.query;
  let sql = residentSelect + ' WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (room_id) { sql += ' AND r.room_id = ?'; params.push(room_id); }
  if (q) {
    sql += ' AND (r.first_name LIKE ? OR r.last_name LIKE ? OR r.national_id LIKE ? OR r.phone LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY r.first_name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const resident = db.prepare(residentSelect + ' WHERE r.id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  res.json(resident);
});

router.post('/', (req, res) => {
  const { first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, notes } = req.body || {};
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });
  const info = db.prepare(
    `INSERT INTO residents (first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(first_name, last_name, phone || null, email || null, national_id || null, photo_path || null,
        room_id || null, status || 'active', move_in_date || null, notes || null);
  res.status(201).json(db.prepare(residentSelect + ' WHERE r.id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  const { first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, move_out_date, notes } = req.body || {};
  db.prepare(
    `UPDATE residents SET first_name = ?, last_name = ?, phone = ?, email = ?, national_id = ?,
       photo_path = ?, room_id = ?, status = ?, move_in_date = ?, move_out_date = ?, notes = ? WHERE id = ?`
  ).run(first_name ?? resident.first_name, last_name ?? resident.last_name, phone ?? resident.phone,
        email ?? resident.email, national_id ?? resident.national_id, photo_path ?? resident.photo_path,
        room_id ?? resident.room_id, status ?? resident.status, move_in_date ?? resident.move_in_date,
        move_out_date ?? resident.move_out_date, notes ?? resident.notes, resident.id);
  res.json(db.prepare(residentSelect + ' WHERE r.id = ?').get(resident.id));
});

router.delete('/:id', (req, res) => {
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  db.prepare('DELETE FROM residents WHERE id = ?').run(resident.id);
  res.json({ ok: true });
});

export default router;
