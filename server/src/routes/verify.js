import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Resident verification roster: rooms + occupants (photos, type, capacity).
// This is the security-focused screen to confirm someone claiming residence.
router.get('/roster', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  const residents = db.prepare(
    `SELECT id, first_name, last_name, phone, email, national_id, photo_path, room_id, move_in_date, status
     FROM residents WHERE status = 'active' ORDER BY first_name`
  ).all();

  const byRoom = {};
  for (const r of residents) {
    (byRoom[r.room_id] = byRoom[r.room_id] || []).push(r);
  }

  const result = rooms.map((room) => ({
    ...room,
    occupants: (byRoom[room.id] || []).map((o) => ({
      ...o,
      room_name: room.name,
      room_type: room.type,
    })),
  }));
  res.json(result);
});

export default router;
