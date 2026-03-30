import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';

export const GET: APIRoute = async () => {
  const { DB: db } = await getCfEnv();
  const { results } = await db.prepare(
    'SELECT * FROM custom_email_templates ORDER BY updated_at DESC'
  ).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.name || !body.subject || !body.body) {
    return new Response(JSON.stringify({ error: 'name, subject, and body are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO custom_email_templates (id, name, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.subject, body.body, now, now).run();

  const template = await db.prepare(
    'SELECT * FROM custom_email_templates WHERE id = ?'
  ).bind(id).first();

  return new Response(JSON.stringify(template), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
