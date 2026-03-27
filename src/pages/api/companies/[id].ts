import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const PUT: APIRoute = async ({ params, request }) => {
  const db = (env as any).DB;
  const { id } = params;
  const body = await request.json();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  const updatable = [
    'name', 'category_id', 'address', 'postcode', 'lat', 'lng',
    'phone', 'website', 'generic_email', 'contact_name', 'contact_email',
    'contact_phone', 'status', 'priority', 'source', 'source_url',
    'google_place_id', 'follow_up_date',
  ];

  for (const field of updatable) {
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

  // Verify company exists before updating
  const existing = await db.prepare('SELECT id FROM companies WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Company not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  const company = await db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM companies c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
  `).bind(id).first();

  return new Response(JSON.stringify(company), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = (env as any).DB;
  const { id } = params;

  // Foreign keys with ON DELETE CASCADE handle notes and email_log
  await db.prepare('PRAGMA foreign_keys = ON').run();
  await db.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
