import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.HOSTEL_DATA_DIR || path.join(__dirname, '..', 'data');
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

CREATE TABLE IF NOT EXISTS sleepover_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER NOT NULL UNIQUE REFERENCES visitors(id) ON DELETE RESTRICT,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  nights INTEGER NOT NULL CHECK (nights BETWEEN 1 AND 14),
  nightly_rate INTEGER NOT NULL CHECK (nightly_rate > 0),
  requested_method TEXT NOT NULL CHECK (requested_method IN ('mtn_momo','airtel_money','card','cash')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

// Agreements and their collection ledger are separate from legacy/manual payments.
db.exec(`
CREATE TABLE IF NOT EXISTS stays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('bachelor','ldc','other')),
  billing_basis TEXT NOT NULL CHECK (billing_basis IN ('fixed','monthly')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stay_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stay_id INTEGER NOT NULL REFERENCES stays(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  due_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stay_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES stay_invoices(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid_on TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','bank','mtn_momo','airtel_money','other')),
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS stays_room_dates ON stays(room_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS stay_receipts_invoice ON stay_receipts(invoice_id);
`);

// Capture room association when a visitor or legacy payment is recorded so
// moving a resident later does not move the room's history with them.
for (const table of ['visitors', 'payments']) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(column => column.name === 'room_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL`);
  }
  if (!columns.some(column => column.name === 'room_attribution')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN room_attribution TEXT NOT NULL DEFAULT 'legacy'`);

  }
  const eventDate = table === 'visitors' ? 'COALESCE(NEW.check_in_time, NEW.expected_arrival, NEW.created_at)' : 'COALESCE(NEW.due_date, NEW.paid_at, NEW.created_at)';
  db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_capture_room AFTER INSERT ON ${table}
    BEGIN
      UPDATE ${table} SET room_id=COALESCE(NEW.room_id,
        (SELECT room_id FROM stays WHERE resident_id=NEW.resident_id AND start_date<=substr(${eventDate},1,10) AND end_date>=substr(${eventDate},1,10) ORDER BY start_date DESC LIMIT 1),
        (SELECT room_id FROM residents WHERE id=NEW.resident_id)), room_attribution='recorded'
      WHERE id=NEW.id;
    END`);
}

db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
if (!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get('room_history_backfill_v1')) {
  db.transaction(()=>{
    for (const table of ['visitors','payments']) {
      const eventDate=table==='visitors'?`COALESCE(${table}.check_in_time,${table}.expected_arrival,${table}.created_at)`:`COALESCE(${table}.due_date,${table}.paid_at,${table}.created_at)`;
      db.exec(`UPDATE ${table} SET room_id=COALESCE(
        (SELECT room_id FROM stays WHERE resident_id=${table}.resident_id AND start_date<=substr(${eventDate},1,10) AND end_date>=substr(${eventDate},1,10) ORDER BY start_date DESC LIMIT 1),
        (SELECT room_id FROM residents WHERE id=${table}.resident_id)) WHERE room_id IS NULL AND room_attribution='legacy'`);
    }
    db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run('room_history_backfill_v1');
  })();
}

// Private agreement snapshots: generated versions and signed copies are retained.
db.exec(`
CREATE TABLE IF NOT EXISTS tenancy_documents (
  id TEXT PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('generated','signed')),
  filename TEXT NOT NULL,
  snapshot TEXT,
  pdf BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tenancy_documents_resident ON tenancy_documents(resident_id,created_at);
`);

// Reusable communication groups; each published custom notice snapshots recipients.
db.exec(`
CREATE TABLE IF NOT EXISTS announcement_audiences (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL COLLATE NOCASE UNIQUE,
 description TEXT,
 archived INTEGER NOT NULL DEFAULT 0,
 created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS announcement_audience_members (
 audience_id INTEGER NOT NULL REFERENCES announcement_audiences(id) ON DELETE CASCADE,
 recipient_key TEXT NOT NULL,
 resident_id INTEGER REFERENCES residents(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
 CHECK ((resident_id IS NOT NULL AND user_id IS NULL) OR (resident_id IS NULL AND user_id IS NOT NULL)),
 PRIMARY KEY(audience_id,recipient_key)
);
CREATE TABLE IF NOT EXISTS announcement_recipients (
 announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
 recipient_key TEXT NOT NULL,
 resident_id INTEGER REFERENCES residents(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
 CHECK ((resident_id IS NOT NULL AND user_id IS NULL) OR (resident_id IS NULL AND user_id IS NOT NULL)),
 PRIMARY KEY(announcement_id,recipient_key)
);
`);
const announcementColumns=db.prepare('PRAGMA table_info(announcements)').all();
for(const [name,type] of [
 ['audience_group_id','INTEGER REFERENCES announcement_audiences(id) ON DELETE RESTRICT'],
 ['audience_label','TEXT'],
 ['recipient_count','INTEGER']
])if(!announcementColumns.some(c=>c.name===name))db.exec(`ALTER TABLE announcements ADD COLUMN ${name} ${type}`);

// SMS previews are immutable, single-use send requests and an audit of provider acceptance.
db.exec(`CREATE TABLE IF NOT EXISTS announcement_sms (
 id TEXT PRIMARY KEY,
 announcement_id INTEGER REFERENCES announcements(id) ON DELETE SET NULL,
 created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 message TEXT NOT NULL,
 mode TEXT NOT NULL,
 sender TEXT NOT NULL,
 config_fingerprint TEXT NOT NULL,
 test INTEGER NOT NULL DEFAULT 0,
 recipients TEXT NOT NULL,
 skipped TEXT NOT NULL,
 results TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'draft',
 error TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 submitted_at TEXT
);`);

db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 value TEXT NOT NULL,
 updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
