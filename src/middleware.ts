import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow login page, auth API, and static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/favicon')
  ) {
    return next();
  }

  const secret = process.env.SESSION_SECRET ?? '';
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
