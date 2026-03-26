-- B2B Prospect Tracker Schema

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  address TEXT,
  postcode TEXT,
  lat REAL,
  lng REAL,
  phone TEXT,
  website TEXT,
  generic_email TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK(status IN ('new','contacted','follow_up','in_conversation','partner','rejected','not_interested')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('high','medium','low')),
  source TEXT,
  source_url TEXT,
  google_place_id TEXT,
  follow_up_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK(status IN ('sent','failed')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default categories
INSERT OR IGNORE INTO categories (id, name, color) VALUES
  ('cat-solicitor', 'Solicitor', '#818cf8'),
  ('cat-estate-agent', 'Estate Agent', '#f59e0b'),
  ('cat-nursing-home', 'Nursing Home', '#10b981'),
  ('cat-surveyor', 'Surveyor', '#3b82f6'),
  ('cat-conveyancer', 'Conveyancer', '#ec4899'),
  ('cat-other', 'Other', '#6b7280');
