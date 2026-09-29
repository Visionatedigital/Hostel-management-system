import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

// Residents see announcements for everyone and for residents; admin sees all. Security has no access.
router.get('/', (req, res) => {
  if (req.user.role === 'security') return res.status(403).json({ error: 'Insufficient permissions' });
  let sql = `SELECT a.*, u.full_name AS author_name
     FROM announcements a LEFT JOIN users u ON u.id = a.created_by`;
  const params = [];
  if (req.user.role === 'resident') {
    sql += ' WHERE a.audience IN (?, ?)';
    params.push('all', 'residents');
  }
  sql += ' ORDER BY a.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requireRole('admin', 'security'), (req, res) => {
  const { title, body, audience } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const info = db.prepare(
    `INSERT INTO announcements (title, body, audience, created_by) VALUES (?, ?, ?, ?)`
  ).run(title, body || null, audience || 'all', req.user.id);
  res.status(201).json(db.prepare(
    `SELECT a.*, u.full_name AS author_name FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`
  ).get(info.lastInsertRowid));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Announcement not found' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(a.id);
  res.json({ ok: true });
});

export default router;
