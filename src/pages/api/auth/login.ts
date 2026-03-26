import type { APIRoute } from 'astro';
import { createSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json();
  const { password } = body;

  const authPassword = locals.runtime.env.AUTH_PASSWORD as string | undefined;
  const sessionSecret = locals.runtime.env.SESSION_SECRET as string | undefined;

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
