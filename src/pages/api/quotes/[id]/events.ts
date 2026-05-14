import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import { listEvents, getQuote } from '../../../../quotes/db';

export const GET: APIRoute = async ({ params }) => {
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
  const events = await listEvents(cfEnv.DB, id);
  return new Response(JSON.stringify({ events }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
