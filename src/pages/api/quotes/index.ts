import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { createQuote, listQuotes } from '../../../quotes/db';
import { getTemplate, getDefaultFieldData } from '../../../quotes/templates';
import type { QuoteStatus } from '../../../quotes/types';
import { QUOTE_STATUSES } from '../../../quotes/types';

export const GET: APIRoute = async ({ url }) => {
  const cfEnv = await getCfEnv();
  const statusParam = url.searchParams.get('status');
  let status: QuoteStatus | QuoteStatus[] | undefined;
  if (statusParam) {
    const requested = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is QuoteStatus =>
        (QUOTE_STATUSES as readonly string[]).includes(s)
      );
    if (requested.length > 0) status = requested;
  }
  const company_id = url.searchParams.get('company_id') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '100');
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const quotes = await listQuotes(cfEnv.DB, { status, company_id, limit, offset });
  return new Response(JSON.stringify({ quotes }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = await getCfEnv();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { template_id, company_id, contact_id } = body ?? {};
  if (!template_id || typeof template_id !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing required field: template_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!getTemplate(template_id)) {
    return new Response(JSON.stringify({ error: 'Unknown template_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // When creating from a company drawer we seed the recipient from a
  // specific contact (if given) or the company's primary contact.
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  let resolvedContactId: string | null = contact_id ?? null;

  const db = cfEnv.DB as D1Database;

  if (resolvedContactId) {
    const c = (await db
      .prepare('SELECT id, name, email, company_id FROM contacts WHERE id = ?')
      .bind(resolvedContactId)
      .first()) as
      | { id: string; name: string | null; email: string | null; company_id: string }
      | null;
    if (c) {
      recipientEmail = c.email;
      recipientName = c.name;
    } else {
      resolvedContactId = null;
    }
  } else if (company_id) {
    const c = (await db
      .prepare(
        'SELECT id, name, email FROM contacts WHERE company_id = ? AND is_primary = 1 LIMIT 1'
      )
      .bind(company_id)
      .first()) as
      | { id: string; name: string | null; email: string | null }
      | null;
    if (c) {
      resolvedContactId = c.id;
      recipientEmail = c.email;
      recipientName = c.name;
    } else {
      // Fall back to companies.contact_email / contact_name (legacy fields
      // populated by the import flow, mirrored from the primary contact).
      const co = (await db
        .prepare('SELECT contact_email, contact_name FROM companies WHERE id = ?')
        .bind(company_id)
        .first()) as
        | { contact_email: string | null; contact_name: string | null }
        | null;
      if (co) {
        recipientEmail = co.contact_email;
        recipientName = co.contact_name;
      }
    }
  }

  const quote = await createQuote(cfEnv.DB, {
    template_id,
    company_id: company_id ?? null,
    contact_id: resolvedContactId,
    field_data: getDefaultFieldData(template_id),
  });

  if (recipientEmail || recipientName) {
    await cfEnv.DB.prepare(
      `UPDATE quotes
         SET recipient_email = COALESCE(?, recipient_email),
             recipient_name  = COALESCE(?, recipient_name)
       WHERE id = ?`
    )
      .bind(recipientEmail, recipientName, quote.id)
      .run();
    quote.recipient_email = recipientEmail ?? quote.recipient_email;
    quote.recipient_name = recipientName ?? quote.recipient_name;
  }

  return new Response(JSON.stringify(quote), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
