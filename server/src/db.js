import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
export const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'hostel.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','security','resident')),
  phone         TEXT,
  resident_id   INTEGER REFERENCES residents(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  floor      TEXT,
  type       TEXT NOT NULL DEFAULT 'double'
             CHECK (type IN ('single','double','triple','quad','other')),
  capacity   INTEGER NOT NULL DEFAULT 2,
  status     TEXT NOT NULL DEFAULT 'available'
             CHECK (status IN ('available','occupied','maintenance','reserved')),
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS residents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  national_id  TEXT,
  photo_path   TEXT,
  room_id      INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','departed','pending')),
  move_in_date TEXT,
  move_out_date TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visitors (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id        INTEGER REFERENCES residents(id) ON DELETE SET NULL,
  guest_name         TEXT NOT NULL,
  guest_phone        TEXT,
  guest_email        TEXT,
  id_number          TEXT,
  purpose            TEXT,
  expected_arrival   TEXT,
  expected_departure TEXT,
  status             TEXT NOT NULL DEFAULT 'invited'
                     CHECK (status IN ('invited','accepted','arrival_requested','approved',
                                       'checked_in','checked_out','declined',
                                       'expired','cancelled','overdue')),
  ref                TEXT UNIQUE NOT NULL,
  accept_token       TEXT UNIQUE,
  message            TEXT,
  selfie_path        TEXT,
  id_photo_path      TEXT,
  accepted_at        TEXT,
  check_in_time      TEXT,
  check_out_time     TEXT,
  declined_reason    TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER REFERENCES residents(id) ON DELETE SET NULL,
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL DEFAULT 'rent'
              CHECK (type IN ('rent','deposit','other')),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','failed','reversed')),
  method      TEXT CHECK (method IN ('mtn_momo','airtel_money','cash','bank','other')),
  reference   TEXT,
  due_date    TEXT,
  paid_at     TEXT,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER REFERENCES residents(id) ON DELETE SET NULL,
  room_id     INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  category    TEXT,
  description TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','assigned','in_progress','resolved','escalated')),
  assigned_to TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT,
  audience   TEXT NOT NULL DEFAULT 'all'
             CHECK (audience IN ('all','residents','staff')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inspections (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id             INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  resident_id         INTEGER REFERENCES residents(id) ON DELETE SET NULL,
  inspection_date     TEXT,
  condition_notes     TEXT,
  returned_keys       INTEGER NOT NULL DEFAULT 0,
  deductions_proposed INTEGER NOT NULL DEFAULT 0,
  deposit_status      TEXT NOT NULL DEFAULT 'pending'
                      CHECK (deposit_status IN ('pending','proposed','disputed',
                                                'approved','refunded','settled')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export default db;
