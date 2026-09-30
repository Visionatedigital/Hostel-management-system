import { Router } from 'express';
import db from '../db.js';
import { currentOccupants } from '../occupancy.js';

const router = Router();

// Resident verification roster: rooms + occupants (photos, type, capacity).
// This is the security-focused screen to confirm someone claiming residence.
router.get('/roster', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  const result = rooms.map(room => ({...room, occupants: currentOccupants(room.id).map(o => ({...o, room_name:room.name, room_type:room.type}))}));
  res.json(result);
});

export default router;
