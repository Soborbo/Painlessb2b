import { generateId } from '../lib/utils';
import {
  rowToQuote,
  rowToEvent,
  type Quote,
  type QuoteEvent,
  type QuoteEventType,
  type QuoteRow,
  type QuoteEventRow,
  type QuoteStatus,
  type SenderAlias,
} from './types';

// D1Database is declared as a global ambient type in src/env.d.ts
type D1 = D1Database;

export interface CreateQuoteInput {
  template_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  field_data?: Record<string, string>;
  created_by?: string | null;
}

export interface UpdateQuoteInput {
  field_data?: Record<string, string>;
  recipient_email?: string | null;
  recipient_name?: string | null;
  sender_alias?: SenderAlias | null;
  subject?: string | null;
  message_body?: string | null;
  tracking_enabled?: boolean;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createQuote(db: D1, input: CreateQuoteInput): Promise<Quote> {
  const id = generateId();
  const token = randomToken();
  const fieldDataJson = JSON.stringify(input.field_data ?? {});
  await db
    .prepare(
      `INSERT INTO quotes
        (id, template_id, company_id, contact_id, field_data,
         tracking_token, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.template_id,
      input.company_id ?? null,
      input.contact_id ?? null,
      fieldDataJson,
      token,
      input.created_by ?? null
    )
    .run();
  await recordEvent(db, id, 'created', {
    template_id: input.template_id,
    company_id: input.company_id ?? null,
  });
  const quote = await getQuote(db, id);
  if (!quote) throw new Error('Quote disappeared after insert');
  return quote;
}

export async function getQuote(db: D1, id: string): Promise<Quote | null> {
  const row = await db
    .prepare(`SELECT * FROM quotes WHERE id = ?`)
    .bind(id)
    .first<QuoteRow>();
  return row ? rowToQuote(row) : null;
}

export async function getQuoteByMessageId(
  db: D1,
  messageId: string
): Promise<Quote | null> {
  const row = await db
    .prepare(`SELECT * FROM quotes WHERE resend_message_id = ?`)
    .bind(messageId)
    .first<QuoteRow>();
  return row ? rowToQuote(row) : null;
}

export async function getQuoteByToken(
  db: D1,
  token: string
): Promise<Quote | null> {
  const row = await db
    .prepare(`SELECT * FROM quotes WHERE tracking_token = ?`)
    .bind(token)
    .first<QuoteRow>();
  return row ? rowToQuote(row) : null;
}

export interface ListQuotesOptions {
  status?: QuoteStatus | QuoteStatus[];
  company_id?: string;
  limit?: number;
  offset?: number;
}

export async function listQuotes(
  db: D1,
  opts: ListQuotesOptions = {}
): Promise<Quote[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    if (statuses.length > 0) {
      where.push(`status IN (${statuses.map(() => '?').join(',')})`);
      binds.push(...statuses);
    }
  }
  if (opts.company_id) {
    where.push('company_id = ?');
    binds.push(opts.company_id);
  }
  const sql =
    `SELECT * FROM quotes` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY COALESCE(last_activity_at, updated_at) DESC` +
    ` LIMIT ? OFFSET ?`;
  binds.push(opts.limit ?? 100, opts.offset ?? 0);
  const result = await db
    .prepare(sql)
    .bind(...binds)
    .all<QuoteRow>();
  return (result.results ?? []).map(rowToQuote);
}

export async function updateQuote(
  db: D1,
  id: string,
  patch: UpdateQuoteInput
): Promise<Quote | null> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (patch.field_data !== undefined) {
    sets.push('field_data = ?');
    binds.push(JSON.stringify(patch.field_data));
  }
  if (patch.recipient_email !== undefined) {
    sets.push('recipient_email = ?');
    binds.push(patch.recipient_email);
  }
  if (patch.recipient_name !== undefined) {
    sets.push('recipient_name = ?');
    binds.push(patch.recipient_name);
  }
  if (patch.sender_alias !== undefined) {
    sets.push('sender_alias = ?');
    binds.push(patch.sender_alias);
  }
  if (patch.subject !== undefined) {
    sets.push('subject = ?');
    binds.push(patch.subject);
  }
  if (patch.message_body !== undefined) {
    sets.push('message_body = ?');
    binds.push(patch.message_body);
  }
  if (patch.tracking_enabled !== undefined) {
    sets.push('tracking_enabled = ?');
    binds.push(patch.tracking_enabled ? 1 : 0);
  }
  if (sets.length === 0) {
    return getQuote(db, id);
  }
  sets.push(`updated_at = datetime('now')`);
  binds.push(id);
  await db
    .prepare(`UPDATE quotes SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();
  return getQuote(db, id);
}

export async function setQuoteStatus(
  db: D1,
  id: string,
  status: QuoteStatus,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const current = await getQuote(db, id);
  if (!current) return;
  await db
    .prepare(
      `UPDATE quotes
         SET status = ?,
             last_activity_at = datetime('now'),
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(status, id)
    .run();
  await recordEvent(db, id, 'status_changed', {
    from: current.status,
    to: status,
    ...payload,
  });
}

export async function markSent(
  db: D1,
  id: string,
  resendMessageId: string,
  pdfR2Key: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE quotes
         SET status = 'sent',
             resend_message_id = ?,
             pdf_r2_key = ?,
             sent_at = datetime('now'),
             last_activity_at = datetime('now'),
             updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(resendMessageId, pdfR2Key, id)
    .run();
}

export async function markOpened(db: D1, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE quotes
         SET status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
             first_opened_at = COALESCE(first_opened_at, datetime('now')),
             last_activity_at = datetime('now')
       WHERE id = ?`
    )
    .bind(id)
    .run();
}

export async function markClicked(db: D1, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE quotes
         SET status = CASE
                        WHEN status IN ('sent','opened') THEN 'clicked'
                        ELSE status
                      END,
             last_activity_at = datetime('now')
       WHERE id = ?`
    )
    .bind(id)
    .run();
}

export async function setDealValue(
  db: D1,
  id: string,
  pence: number
): Promise<void> {
  await db
    .prepare(`UPDATE quotes SET deal_value_pence = ? WHERE id = ?`)
    .bind(pence, id)
    .run();
}

export async function deleteQuote(db: D1, id: string): Promise<void> {
  await db.prepare(`DELETE FROM quotes WHERE id = ?`).bind(id).run();
}

export async function recordEvent(
  db: D1,
  quoteId: string,
  type: QuoteEventType,
  payload: Record<string, unknown> | null = null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO quote_events (id, quote_id, event_type, payload)
       VALUES (?, ?, ?, ?)`
    )
    .bind(
      generateId(),
      quoteId,
      type,
      payload ? JSON.stringify(payload) : null
    )
    .run();
}

export async function listEvents(
  db: D1,
  quoteId: string
): Promise<QuoteEvent[]> {
  const result = await db
    .prepare(
      `SELECT * FROM quote_events
        WHERE quote_id = ?
        ORDER BY occurred_at ASC`
    )
    .bind(quoteId)
    .all<QuoteEventRow>();
  return (result.results ?? []).map(rowToEvent);
}
