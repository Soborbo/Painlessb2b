import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const db = (env as any).DB;
  const { id } = params;

  // id here is company_id for GET requests
  const { results } = await db.prepare(
    'SELECT * FROM notes WHERE company_id = ? ORDER BY created_at DESC'
  ).bind(id).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = (env as any).DB;
  const { id } = params;

  await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
