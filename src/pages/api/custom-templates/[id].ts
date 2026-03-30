import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';

export const PUT: APIRoute = async ({ params, request }) => {
  const { DB: db } = await getCfEnv();
  const { id } = params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  for (const field of ['name', 'subject', 'body']) {
    if (field in body) {
      fields.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (fields.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.prepare(
    `UPDATE custom_email_templates SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const template = await db.prepare(
    'SELECT * FROM custom_email_templates WHERE id = ?'
  ).bind(id).first();

  return new Response(JSON.stringify(template), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const { DB: db } = await getCfEnv();
  const { id } = params;
  await db.prepare('DELETE FROM custom_email_templates WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
