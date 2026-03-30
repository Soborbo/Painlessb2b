import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';

export const GET: APIRoute = async () => {
  try {
    const { DB: db } = await getCfEnv();
    const { results } = await db.prepare(
      'SELECT * FROM custom_email_templates ORDER BY updated_at DESC'
    ).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch templates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';

  if (!name || !subject || !bodyText) {
    return new Response(JSON.stringify({ error: 'name, subject, and body are required (non-empty)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const id = generateId();
    const now = new Date().toISOString();

    await db.prepare(
      'INSERT INTO custom_email_templates (id, name, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, name, subject, bodyText, now, now).run();

    const template = await db.prepare(
      'SELECT * FROM custom_email_templates WHERE id = ?'
    ).bind(id).first();

    return new Response(JSON.stringify(template), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to create template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
