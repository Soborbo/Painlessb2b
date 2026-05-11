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
  const quote = await createQuote(cfEnv.DB, {
    template_id,
    company_id: company_id ?? null,
    contact_id: contact_id ?? null,
    field_data: getDefaultFieldData(template_id),
  });
  return new Response(JSON.stringify(quote), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
