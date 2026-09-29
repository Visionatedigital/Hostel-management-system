import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireAuth, requireRole } from './auth.js';
import { uploadsDir } from './db.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import residentRoutes from './routes/residents.js';
import verifyRoutes from './routes/verify.js';
import visitorRoutes from './routes/visitors.js';
import inviteRoutes from './routes/invites.js';
import paymentRoutes from './routes/payments.js';
import maintenanceRoutes from './routes/maintenance.js';
import announcementRoutes from './routes/announcements.js';
import inspectionRoutes from './routes/inspections.js';
import uploadRoutes from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(uploadsDir));

// Public
app.use('/api/auth', authRoutes);

// Authenticated
app.use('/api/rooms', requireAuth, roomRoutes);
app.use('/api/residents', requireAuth, residentRoutes);
app.use('/api/verify', requireAuth, verifyRoutes);
app.use('/api/visitors', requireAuth, visitorRoutes);
app.use('/api/invites', inviteRoutes); // public view/accept, auth'd create
app.use('/api/payments', requireAuth, paymentRoutes);
app.use('/api/maintenance', requireAuth, maintenanceRoutes);
app.use('/api/announcements', requireAuth, announcementRoutes);
app.use('/api/inspections', requireAuth, inspectionRoutes);
app.use('/api/uploads', requireAuth, uploadRoutes);

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve built client if present
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Hostel server running on http://localhost:${PORT}`);
});
