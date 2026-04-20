-- Migration: introduce contacts table (multiple contacts per company).
-- Safe to run multiple times. Run locally:
--   npx wrangler d1 execute <binding> --local --file=./scripts/migrate-contacts.sql
-- Run remotely:
--   npx wrangler d1 execute <binding> --remote --file=./scripts/migrate-contacts.sql

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);

-- Backfill: create one is_primary contact per company that has any legacy
-- contact data and does not already have a contacts row.
INSERT INTO contacts (id, company_id, name, email, phone, is_primary, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  c.id,
  c.contact_name,
  c.contact_email,
  c.contact_phone,
  1,
  c.created_at,
  c.updated_at
FROM companies c
WHERE (
  (c.contact_name  IS NOT NULL AND c.contact_name  != '') OR
  (c.contact_email IS NOT NULL AND c.contact_email != '') OR
  (c.contact_phone IS NOT NULL AND c.contact_phone != '')
)
AND NOT EXISTS (SELECT 1 FROM contacts x WHERE x.company_id = c.id);
