import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import {
  getQuote,
  setQuoteStatus,
  setDealValue,
} from '../../../../quotes/db';
import type { QuoteStatus } from '../../../../quotes/types';

const MANUAL_TARGETS: QuoteStatus[] = ['replied', 'won', 'lost', 'expired'];

export const POST: APIRoute = async ({ params, request }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const target = body.status as QuoteStatus | undefined;
  if (!target || !MANUAL_TARGETS.includes(target)) {
    return new Response(
      JSON.stringify({
        error: 'invalid_target',
        detail: `Allowed: ${MANUAL_TARGETS.join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (quote.status === 'draft') {
    return new Response(
      JSON.stringify({ error: 'cannot_mark_draft', detail: 'Send the quote first.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let dealValuePence: number | null = null;
  if (target === 'won') {
    if (body.deal_value_pence === undefined || body.deal_value_pence === null) {
      return new Response(
        JSON.stringify({ error: 'deal_value_required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const n = Number(body.deal_value_pence);
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
      return new Response(
        JSON.stringify({
          error: 'invalid_deal_value',
          detail: 'deal_value_pence must be a non-negative integer (pence)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    dealValuePence = n;
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  await setQuoteStatus(cfEnv.DB, id, target, {
    reason: reason || undefined,
    deal_value_pence: dealValuePence ?? undefined,
  });
  if (target === 'won' && dealValuePence !== null) {
    await setDealValue(cfEnv.DB, id, dealValuePence);
  }

  const updated = await getQuote(cfEnv.DB, id);
  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};
