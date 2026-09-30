import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import db, { uploadsDir } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { sendInviteEmail } from '../mailer.js';

const router = Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.fieldname}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (/^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only images are allowed'))),
});

const visitorSelect = `
  SELECT v.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name,
    sc.payment_id AS sleepover_payment_id, sc.nights AS sleepover_nights,
    sc.start_date AS sleepover_start_date, sc.end_date AS sleepover_end_date,
    p.status AS sleepover_payment_status
  FROM visitors v
  LEFT JOIN residents r ON r.id = v.resident_id
  LEFT JOIN rooms rm ON rm.id = r.room_id
  LEFT JOIN sleepover_charges sc ON sc.visitor_id = v.id
  LEFT JOIN payments p ON p.id = sc.payment_id
`;

// List invites for the current user (resident sees only their own)
router.get('/', requireAuth, (req, res) => {
  let sql = visitorSelect;
  if (req.user.role === 'resident') {
    const u = db.prepare('SELECT resident_id FROM users WHERE id = ?').get(req.user.id);
    sql += ' WHERE v.resident_id = ?';
    res.json(db.prepare(sql + ' ORDER BY v.created_at DESC').all(u?.resident_id || -1));
  } else {
    res.json(db.prepare(sql + ' ORDER BY v.created_at DESC').all());
  }
});

// Resident creates an invite
router.post('/', requireAuth, requireRole('resident', 'admin'), async (req, res) => {
  const { guest_name, guest_email, guest_phone, purpose, expected_arrival, expected_departure, message, resident_id } = req.body || {};
  if (!guest_name || !guest_email) return res.status(400).json({ error: 'Guest name and email are required' });

  let residentId = null;
  if (req.user.role === 'resident') {
    const u = db.prepare('SELECT resident_id FROM users WHERE id = ?').get(req.user.id);
    residentId = u?.resident_id;
  } else {
    residentId = resident_id || null;
  }
  if (!residentId) return res.status(400).json({ error: 'Your account is not linked to a resident record' });

  const ref = 'VLT-' + Math.floor(1000 + Math.random() * 9000);
  const acceptToken = crypto.randomBytes(16).toString('hex');

  const info = db.prepare(
    `INSERT INTO visitors (resident_id, guest_name, guest_phone, guest_email, purpose,
       expected_arrival, expected_departure, status, ref, accept_token, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?)`
  ).run(residentId, guest_name, guest_phone || null, guest_email, purpose || null,
        expected_arrival || null, expected_departure || null, ref, acceptToken, message || null);

  const inviteUrl = `${BASE_URL}/invite/${acceptToken}`;
  const resident = db.prepare('SELECT first_name, last_name FROM residents WHERE id = ?').get(residentId);

  const emailResult = await sendInviteEmail({
    to: guest_email,
    guestName: guest_name,
    hostName: resident ? `${resident.first_name} ${resident.last_name}` : 'A resident',
    inviteUrl,
    message,
  });

  const visitor = db.prepare(visitorSelect + ' WHERE v.id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...visitor, invite_url: inviteUrl, email: emailResult });
});

// Public: view invite details for the acceptance page
router.get('/:token', (req, res) => {
  const v = db.prepare(visitorSelect + ' WHERE v.accept_token = ?').get(req.params.token);
  if (!v) return res.status(404).json({ error: 'Invitation not found' });
  res.json({
    guest_name: v.guest_name,
    host_name: v.resident_first ? `${v.resident_first} ${v.resident_last}` : 'A resident',
    expected_arrival: v.expected_arrival,
    expected_departure: v.expected_departure,
    purpose: v.purpose,
    message: v.message,
    status: v.status,
  });
});

// Public: accept the invite with a selfie and ID photo
router.post('/:token/accept', upload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'id_photo', maxCount: 1 },
]), (req, res) => {
  const v = db.prepare('SELECT * FROM visitors WHERE accept_token = ?').get(req.params.token);
  if (!v) return res.status(404).json({ error: 'Invitation not found' });
  if (v.status !== 'invited') return res.status(409).json({ error: `This invitation has already been ${v.status.replace(/_/g, ' ')}` });

  const selfie = req.files?.selfie?.[0];
  const idPhoto = req.files?.id_photo?.[0];
  if (!selfie || !idPhoto) return res.status(400).json({ error: 'A selfie and an ID photo are both required' });

  db.prepare(
    `UPDATE visitors SET status = 'accepted', selfie_path = ?, id_photo_path = ?, accepted_at = datetime('now')
     WHERE id = ?`
  ).run(`/uploads/${selfie.filename}`, `/uploads/${idPhoto.filename}`, v.id);

  res.json({ ok: true, status: 'accepted' });
});

export default router;
