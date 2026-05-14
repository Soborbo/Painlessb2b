import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/auth';
import { getCfEnv } from './lib/cf-env';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow login page, auth API, static assets, and the public quote-tool
  // endpoints (click redirects + Resend webhooks — each does its own
  // signature/token verification).
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/r/') ||
    pathname === '/api/webhooks/resend'
  ) {
    return next();
  }

  const cfEnv = await getCfEnv();
  const secret = cfEnv.SESSION_SECRET as string | undefined;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const cookie = context.request.headers.get('cookie');
  const valid = await verifySession(cookie, secret);

  if (!valid) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // For pages, redirect to login
    return context.redirect('/login', 302);
  }

  return next();
});
