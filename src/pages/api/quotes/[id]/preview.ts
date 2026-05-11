import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import { getQuote } from '../../../../quotes/db';
import { renderQuoteHtml } from '../../../../quotes/renderer';

export const GET: APIRoute = async ({ params }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) return new Response('Missing id', { status: 400 });
  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) return new Response('Not found', { status: 404 });
  const html = renderQuoteHtml(quote.template_id, quote.field_data);
  if (html === null) return new Response('Unknown template', { status: 500 });
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Preview iframes reload on every save; never want a cached stale view.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
