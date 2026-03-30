import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';
import { generateId } from '../../lib/utils';

export const GET: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const companyId = url.searchParams.get('company_id');

  let query = `
    SELECT al.*, c.name as company_name
    FROM activity_log al
    LEFT JOIN companies c ON al.company_id = c.id
  `;
  const params: any[] = [];

  if (companyId) {
    query += ' WHERE al.company_id = ?';
    params.push(companyId);
  }

  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await db.prepare(query).bind(...params).all();
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

  if (!body.action) {
    return new Response(JSON.stringify({ error: 'Action is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  await db.prepare(
    'INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(id, body.company_id || null, body.action, body.details || null).run();

  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
