import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import { roomHistory } from '../room-history.js';
import { currentOccupants } from '../occupancy.js';

const router = Router();

// List rooms with occupant summary
router.get('/', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  const result = rooms.map(r => ({...r, occupant_count: currentOccupants(r.id).length}));
  res.json(result);
});

router.get('/:id/history', requireRole('admin'), (req,res) => {
  const id=Number(req.params.id);
  if (!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:'Invalid room.'});
  const history=roomHistory(id);
  if (!history) return res.status(404).json({error:'Room not found.'});
  res.json(history);
});

router.get('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const occupants = currentOccupants(room.id);
  res.json({ ...room, occupants });
});

router.post('/', (req, res) => {
  const { name, floor, type, capacity, status, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Room name required' });
  const exists = db.prepare('SELECT id FROM rooms WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Room name already exists' });
  const info = db.prepare(
    `INSERT INTO rooms (name, floor, type, capacity, status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name, floor || null, type || 'double', capacity || 2, status || 'available', notes || null);
  res.status(201).json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { name, floor, type, capacity, status, notes } = req.body || {};
  db.prepare(
    `UPDATE rooms SET name = ?, floor = ?, type = ?, capacity = ?, status = ?, notes = ? WHERE id = ?`
  ).run(name ?? room.name, floor ?? room.floor, type ?? room.type, capacity ?? room.capacity,
        status ?? room.status, notes ?? room.notes, room.id);
  res.json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id));
});

router.delete('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  db.prepare('UPDATE residents SET room_id = NULL WHERE room_id = ?').run(room.id);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
  res.json({ ok: true });
});

export default router;
