import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import { getQuote } from '../../../../quotes/db';
import { renderQuoteHtml } from '../../../../quotes/renderer';

export const GET: APIRoute = async ({ params, url }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) return new Response('Missing id', { status: 400 });
  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) return new Response('Not found', { status: 404 });
  // ?edit=1 → the click-to-edit editor preview (data-qf spans + runtime).
  // Without it the endpoint serves the plain rendered proposal.
  const editable = url.searchParams.get('edit') === '1';
  const html = renderQuoteHtml(quote.template_id, quote.field_data, { editable });
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
