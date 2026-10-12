import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();
const attempts = new Map();
const verifications = new Map();

const visitorSelect = `
  SELECT v.*, r.first_name AS resident_first, r.last_name AS resident_last, rm.name AS room_name,
    sc.nights AS sleepover_nights, p.status AS sleepover_payment_status
  FROM visitors v
  LEFT JOIN residents r ON r.id = v.resident_id
  LEFT JOIN rooms rm ON rm.id = v.room_id
  LEFT JOIN sleepover_charges sc ON sc.visitor_id = v.id
  LEFT JOIN payments p ON p.id = sc.payment_id
`;
const present = row => {
  if (!row) return row;
  const { gate_code, gate_code_sms_error, gate_code_sms_reference, accept_token, ...safe } = row;
  return { ...safe, has_gate_code: Boolean(gate_code) };
};

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = visitorSelect + ' WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND v.status = ?'; params.push(status); }
  sql += ' ORDER BY v.created_at DESC';
  res.json(db.prepare(sql).all(...params).map(present));
});

router.get('/:id', (req, res) => {
  const v = db.prepare(visitorSelect + ' WHERE v.id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  res.json(present(v));
});

router.post('/verify-code', requireRole('admin', 'security'), (req, res) => {
  const key = req.ip;
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many incorrect attempts. Try again in 15 minutes.' });

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the six-digit access code.' });
  const visitor = db.prepare(visitorSelect + " WHERE v.gate_code = ? AND v.status = 'accepted'").get(code);
  if (!visitor) {
    recent.push(now);
    attempts.set(key, recent);
    return res.status(400).json({ error: 'Incorrect or inactive access code.' });
  }

  attempts.delete(key);
  const verificationToken = crypto.randomUUID();
  verifications.set(verificationToken, { visitorId: visitor.id, userId: req.user.id, expiresAt: now + 5 * 60 * 1000 });
  res.json({ ...present(visitor), verification_token: verificationToken });
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
  res.status(201).json(present(db.prepare(visitorSelect + ' WHERE v.id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  const { resident_id, guest_name, guest_phone, guest_email, id_number, purpose, expected_arrival, expected_departure, status, declined_reason, verification_token } = req.body || {};
  let newStatus = status ?? v.status;
  if (v.status === 'accepted' && (newStatus === 'approved' || newStatus === 'checked_in')) {
    const verification = typeof verification_token === 'string' ? verifications.get(verification_token) : null;
    if (!verification || verification.visitorId !== v.id || verification.userId !== req.user.id || verification.expiresAt < Date.now()) {
      if (verification_token) verifications.delete(verification_token);
      return res.status(403).json({ error: 'Enter the guest access code again before checking this visitor in.' });
    }
    verifications.delete(verification_token);
    newStatus = 'checked_in';
  }
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
  res.json(present(db.prepare(visitorSelect + ' WHERE v.id = ?').get(v.id)));
});

router.delete('/:id', (req, res) => {
  const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  db.prepare('DELETE FROM visitors WHERE id = ?').run(v.id);
  res.json({ ok: true });
});

export default router;
