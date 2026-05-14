import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import { getQuote, updateQuote, recordEvent } from '../../../../quotes/db';
import { getDefaultFieldData } from '../../../../quotes/templates';

export const POST: APIRoute = async ({ params }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (quote.status !== 'draft') {
    return new Response(
      JSON.stringify({ error: 'Only draft quotes can be reset' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const defaults = getDefaultFieldData(quote.template_id);
  const updated = await updateQuote(cfEnv.DB, id, { field_data: defaults });
  await recordEvent(cfEnv.DB, id, 'reset');
  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};
