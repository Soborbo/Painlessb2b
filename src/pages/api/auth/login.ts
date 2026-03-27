import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { password } = body;

  const authPassword = (env as any).AUTH_PASSWORD as string | undefined;
  const sessionSecret = (env as any).SESSION_SECRET as string | undefined;

  if (!authPassword || !sessionSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!password || password !== authPassword) {
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
