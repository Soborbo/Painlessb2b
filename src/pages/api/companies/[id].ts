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
  const { DB: db } = await getCfEnv();
  const { id } = params;

  // Manually delete related records since D1 PRAGMA foreign_keys may not persist across statements
  await db.prepare('DELETE FROM notes WHERE company_id = ?').bind(id).run();
  await db.prepare('DELETE FROM email_log WHERE company_id = ?').bind(id).run();
  await db.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
