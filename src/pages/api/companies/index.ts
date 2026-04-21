import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';

export const GET: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  const url = new URL(request.url);

  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');
  const priority = url.searchParams.get('priority');
  const search = url.searchParams.get('search');
  const hasEmail = url.searchParams.get('has_email');
  const hasContact = url.searchParams.get('has_contact');
  const overdue = url.searchParams.get('overdue');

  let query = `
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM companies c
    LEFT JOIN categories cat ON c.category_id = cat.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    const statuses = status.split(',');
    conditions.push(`c.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }

  if (category) {
    const cats = category.split(',');
    conditions.push(`c.category_id IN (${cats.map(() => '?').join(',')})`);
    params.push(...cats);
  }

  if (priority) {
    const pris = priority.split(',');
    conditions.push(`c.priority IN (${pris.map(() => '?').join(',')})`);
    params.push(...pris);
  }

  if (search) {
    conditions.push(`(
      c.name LIKE ? OR c.address LIKE ? OR c.postcode LIKE ? OR c.contact_name LIKE ?
      OR c.id IN (SELECT n.company_id FROM notes n WHERE n.body LIKE ?)
      OR c.id IN (SELECT ct.company_id FROM contacts ct WHERE ct.name LIKE ? OR ct.email LIKE ?)
    )`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }

  if (hasEmail === 'true') {
    conditions.push(`(
      (c.contact_email IS NOT NULL AND c.contact_email != '')
      OR (c.generic_email IS NOT NULL AND c.generic_email != '')
      OR c.id IN (SELECT ct.company_id FROM contacts ct WHERE ct.email IS NOT NULL AND ct.email != '')
    )`);
  }

  if (hasContact === 'true') {
    conditions.push(`(
      (c.contact_name IS NOT NULL AND c.contact_name != '')
      OR c.id IN (SELECT ct.company_id FROM contacts ct WHERE ct.name IS NOT NULL AND ct.name != '')
    )`);
  }

  if (overdue === 'true') {
    conditions.push(`c.follow_up_date <= datetime('now') AND c.status NOT IN ('partner', 'rejected', 'not_interested')`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY c.updated_at DESC';

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
  if (!body.name) {
    return new Response(JSON.stringify({ error: 'Company name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const id = generateId();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO companies (id, name, category_id, address, postcode, lat, lng, phone, website, generic_email, contact_name, contact_email, contact_phone, status, priority, source, source_url, google_place_id, follow_up_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.category_id || null,
    body.address || null,
    body.postcode || null,
    body.lat ?? null,
    body.lng ?? null,
    body.phone || null,
    body.website || null,
    body.generic_email || null,
    body.contact_name || null,
    body.contact_email || null,
    body.contact_phone || null,
    body.status || 'new',
    body.priority || 'medium',
    body.source || null,
    body.source_url || null,
    body.google_place_id || null,
    body.follow_up_date || null,
    now,
    now
  ).run();

  // Seed a primary contact row if any contact data was provided, so the new
  // contacts table stays the source of truth for people-level details.
  if (body.contact_name || body.contact_email || body.contact_phone) {
    await db.prepare(
      `INSERT INTO contacts (id, company_id, name, email, phone, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      generateId(),
      id,
      body.contact_name || null,
      body.contact_email || null,
      body.contact_phone || null,
      now,
      now
    ).run();
  }

  const company = await db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM companies c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
  `).bind(id).first();
  return new Response(JSON.stringify(company), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
