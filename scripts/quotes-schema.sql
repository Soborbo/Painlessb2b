-- Quote / Proposal tool — schema migration
-- Run with:
--   npx wrangler d1 execute b2bpainless --remote --file=./scripts/quotes-schema.sql
-- For local dev:
--   npx wrangler d1 execute b2bpainless --local --file=./scripts/quotes-schema.sql

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  sender_alias TEXT,
  subject TEXT,
  message_body TEXT,
  field_data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN (
      'draft','sent','opened','clicked','replied','won','lost','expired'
    )),
  deal_value_pence INTEGER,
  pdf_r2_key TEXT,
  resend_message_id TEXT,
  tracking_token TEXT UNIQUE,
  tracking_enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  first_opened_at TEXT,
  last_activity_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_resend_message_id ON quotes(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tracking_token ON quotes(tracking_token);
CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON quotes(updated_at);

CREATE TABLE IF NOT EXISTS quote_events (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK(event_type IN (
      'created','edited','sent','opened','clicked',
      'replied','status_changed','bounced','complained',
      'reset'
    )),
  payload TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote_id ON quote_events(quote_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_quote_events_type ON quote_events(event_type);
