import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import { getQuote } from '../../../../quotes/db';
import { getTemplate } from '../../../../quotes/templates';
import { renderQuoteHtml } from '../../../../quotes/renderer';
import { renderQuotePdf, PdfRenderError } from '../../../../quotes/pdf';

export const GET: APIRoute = async ({ params, url }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!cfEnv.BROWSER) {
    return new Response(
      JSON.stringify({
        error: 'Browser Rendering not configured',
        detail: 'The BROWSER binding is not bound. Confirm Workers Paid plan and wrangler.toml [browser] entry.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const entry = getTemplate(quote.template_id);
  if (!entry) {
    return new Response(JSON.stringify({ error: 'Template missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const html = renderQuoteHtml(quote.template_id, quote.field_data);
  if (!html) {
    return new Response(JSON.stringify({ error: 'Render failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const pdfBytes = await renderQuotePdf(
      cfEnv.BROWSER as any,
      html,
      entry.meta,
      quote.field_data,
      { trackingEnabled: quote.tracking_enabled }
    );
    const filename = `painless-removals-quote-${quote.id.slice(0, 8)}.pdf`;
    const disposition = url.searchParams.get('download') === '1'
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;
    return new Response(pdfBytes as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (e) {
    if (e instanceof PdfRenderError) {
      return new Response(
        JSON.stringify({ error: e.reason, detail: e.detail }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('pdf render failed', e);
    return new Response(
      JSON.stringify({
        error: 'render_failed',
        detail: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
