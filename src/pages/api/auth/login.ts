import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { createSessionCookie } from '../../../lib/auth';

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
  const { password } = body;

  const authPassword = cfEnv.AUTH_PASSWORD as string | undefined;
  const sessionSecret = cfEnv.SESSION_SECRET as string | undefined;

  if (!authPassword || !sessionSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use constant-time comparison to prevent timing attacks
  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const encoder = new TextEncoder();
  const a = encoder.encode(password.padEnd(256));
  const b = encoder.encode(authPassword.padEnd(256));
  const match = a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookie = await createSessionCookie(sessionSecret);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};
