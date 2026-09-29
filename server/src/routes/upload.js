import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../db.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.status(201).json({ path: `/uploads/${req.file.filename}` });
});

router.delete('/photo', (req, res) => {
  const { path: relPath } = req.body || {};
  if (!relPath || !relPath.startsWith('/uploads/')) return res.status(400).json({ error: 'Invalid path' });
  const filename = path.basename(relPath);
  const full = path.join(uploadsDir, filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  res.json({ ok: true });
});

export default router;
