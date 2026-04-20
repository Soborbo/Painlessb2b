import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';

export const GET: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  const url = new URL(request.url);
  const companyId = url.searchParams.get('company_id');

  if (!companyId) {
    return new Response(JSON.stringify({ error: 'company_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results } = await db.prepare(
    `SELECT * FROM contacts WHERE company_id = ?
     ORDER BY is_primary DESC, created_at ASC`
  ).bind(companyId).all();

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

  if (!body.company_id) {
    return new Response(JSON.stringify({ error: 'company_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const company = await db.prepare('SELECT id FROM companies WHERE id = ?').bind(body.company_id).first();
  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  const now = new Date().toISOString();

  // If no primary exists yet for this company, make this one primary.
  const existingPrimary = await db.prepare(
    'SELECT id FROM contacts WHERE company_id = ? AND is_primary = 1'
  ).bind(body.company_id).first();
  const wantsPrimary = body.is_primary === true || body.is_primary === 1;
  const isPrimary = wantsPrimary || !existingPrimary ? 1 : 0;

  // If making this primary, demote any current primary.
  if (isPrimary && existingPrimary) {
    await db.prepare(
      'UPDATE contacts SET is_primary = 0, updated_at = ? WHERE company_id = ? AND is_primary = 1'
    ).bind(now, body.company_id).run();
  }

  await db.prepare(
    `INSERT INTO contacts (id, company_id, name, email, phone, role, is_primary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.company_id,
    body.name || null,
    body.email || null,
    body.phone || null,
    body.role || null,
    isPrimary,
    now,
    now
  ).run();

  if (isPrimary) {
    await syncPrimaryToCompany(db, body.company_id);
  }
  await touchCompany(db, body.company_id, now);

  const contact = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify(contact), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function touchCompany(db: any, companyId: string, now: string) {
  await db.prepare('UPDATE companies SET updated_at = ? WHERE id = ?').bind(now, companyId).run();
}

async function syncPrimaryToCompany(db: any, companyId: string) {
  const primary: any = await db.prepare(
    'SELECT name, email, phone FROM contacts WHERE company_id = ? AND is_primary = 1 LIMIT 1'
  ).bind(companyId).first();
  await db.prepare(
    'UPDATE companies SET contact_name = ?, contact_email = ?, contact_phone = ? WHERE id = ?'
  ).bind(primary?.name ?? null, primary?.email ?? null, primary?.phone ?? null, companyId).run();
}
