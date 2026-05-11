import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';
import {
  getQuoteByToken,
  markClicked,
  recordEvent,
} from '../../quotes/db';
import { decodeTargetUrl } from '../../quotes/tracking';

// Public route (allow-listed in middleware). Always responds with 302/200
// — never reveals whether the token is valid, to avoid token enumeration.
export const GET: APIRoute = async ({ params, request, url }) => {
  const token = params.token;
  if (!token || typeof token !== 'string') {
    return new Response('Not found', { status: 404 });
  }
  const encoded = url.searchParams.get('u');
  if (!encoded) return new Response('Not found', { status: 404 });

  let target: string;
  try {
    target = decodeTargetUrl(encoded);
  } catch {
    return new Response('Bad target', { status: 400 });
  }

  // Only http(s) and mailto targets — guards against javascript:/data: etc.
  if (!/^(https?:|mailto:|tel:)/i.test(target)) {
    return new Response('Bad target', { status: 400 });
  }

  const cfEnv = await getCfEnv();
  const quote = await getQuoteByToken(cfEnv.DB, token);
  if (quote && quote.tracking_enabled) {
    await markClicked(cfEnv.DB, quote.id);
    await recordEvent(cfEnv.DB, quote.id, 'clicked', {
      url: target,
      ip: request.headers.get('cf-connecting-ip') ?? null,
      ua: request.headers.get('user-agent') ?? null,
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
