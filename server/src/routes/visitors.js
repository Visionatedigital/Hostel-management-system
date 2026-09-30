import { Router } from 'express';
import db from '../db.js';

const router = Router();

const visitorSelect = `
  SELECT v.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name
  FROM visitors v
  LEFT JOIN residents r ON r.id = v.resident_id
  LEFT JOIN rooms rm ON rm.id = v.room_id
`;

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = visitorSelect + ' WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND v.status = ?'; params.push(status); }
  sql += ' ORDER BY v.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const v = db.prepare(visitorSelect + ' WHERE v.id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  res.json(v);
});

router.post('/', (req, res) => {
  const { resident_id, guest_name, guest_phone, guest_email, id_number, purpose, expected_arrival, expected_departure, status } = req.body || {};
  if (!guest_name) return res.status(400).json({ error: 'Guest name required' });
  const ref = 'VLT-' + Math.floor(1000 + Math.random() * 9000);
  const info = db.prepare(
    `INSERT INTO visitors (resident_id, guest_name, guest_phone, guest_email, id_number, purpose, expected_arrival, expected_departure, status, ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(resident_id || null, guest_name, guest_phone || null, guest_email || null, id_number || null,
        purpose || null, expected_arrival || null, expected_departure || null, status || 'invited', ref);
  res.status(201).json(db.prepare(visitorSelect + ' WHERE v.id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  const { resident_id, guest_name, guest_phone, guest_email, id_number, purpose, expected_arrival, expected_departure, status, declined_reason } = req.body || {};
  const newStatus = status ?? v.status;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const check_in_time = newStatus === 'checked_in' && !v.check_in_time ? now : v.check_in_time;
  const check_out_time = newStatus === 'checked_out' && !v.check_out_time ? now : v.check_out_time;
  db.prepare(
    `UPDATE visitors SET resident_id = ?, guest_name = ?, guest_phone = ?, guest_email = ?, id_number = ?,
       purpose = ?, expected_arrival = ?, expected_departure = ?, status = ?, declined_reason = ?,
       check_in_time = ?, check_out_time = ? WHERE id = ?`
  ).run(resident_id ?? v.resident_id, guest_name ?? v.guest_name, guest_phone ?? v.guest_phone,
        guest_email ?? v.guest_email, id_number ?? v.id_number, purpose ?? v.purpose,
        expected_arrival ?? v.expected_arrival, expected_departure ?? v.expected_departure,
        newStatus, declined_reason ?? v.declined_reason, check_in_time, check_out_time, v.id);
  res.json(db.prepare(visitorSelect + ' WHERE v.id = ?').get(v.id));
});

router.delete('/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  db.prepare('DELETE FROM visitors WHERE id = ?').run(v.id);
  res.json({ ok: true });
});

export default router;
