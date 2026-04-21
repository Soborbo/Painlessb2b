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

  const existing: any = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Contact not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const updatable = ['name', 'email', 'phone', 'role'];
  for (const field of updatable) {
    if (field in body) {
      fields.push(`${field} = ?`);
      values.push(body[field] || null);
    }
  }

  let promotingToPrimary = false;
  if ('is_primary' in body) {
    const wantsPrimary = body.is_primary === true || body.is_primary === 1;
    if (wantsPrimary && !existing.is_primary) {
      promotingToPrimary = true;
    } else if (!wantsPrimary && existing.is_primary) {
      // Prevent removing the only primary without promoting another.
      return new Response(JSON.stringify({ error: 'Cannot unset primary; promote another contact to primary instead.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (promotingToPrimary) {
    await db.prepare(
      'UPDATE contacts SET is_primary = 0, updated_at = ? WHERE company_id = ? AND is_primary = 1'
    ).bind(now, existing.company_id).run();
    fields.push('is_primary = ?');
    values.push(1);
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

  await db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  // Sync legacy company columns if we just touched the primary contact.
  const updated: any = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
  if (updated?.is_primary) {
    await db.prepare(
      'UPDATE companies SET contact_name = ?, contact_email = ?, contact_phone = ?, updated_at = ? WHERE id = ?'
    ).bind(updated.name ?? null, updated.email ?? null, updated.phone ?? null, now, existing.company_id).run();
  } else {
    await db.prepare('UPDATE companies SET updated_at = ? WHERE id = ?').bind(now, existing.company_id).run();
  }

  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const { DB: db } = await getCfEnv();
  const { id } = params;

  const existing: any = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Contact not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await db.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run();

  // If we removed the primary, promote the oldest remaining contact (if any).
  if (existing.is_primary) {
    const next: any = await db.prepare(
      'SELECT id, name, email, phone FROM contacts WHERE company_id = ? ORDER BY created_at ASC LIMIT 1'
    ).bind(existing.company_id).first();

    if (next) {
      await db.prepare(
        'UPDATE contacts SET is_primary = 1, updated_at = ? WHERE id = ?'
      ).bind(now, next.id).run();
      await db.prepare(
        'UPDATE companies SET contact_name = ?, contact_email = ?, contact_phone = ?, updated_at = ? WHERE id = ?'
      ).bind(next.name ?? null, next.email ?? null, next.phone ?? null, now, existing.company_id).run();
    } else {
      await db.prepare(
        'UPDATE companies SET contact_name = NULL, contact_email = NULL, contact_phone = NULL, updated_at = ? WHERE id = ?'
      ).bind(now, existing.company_id).run();
    }
  } else {
    await db.prepare('UPDATE companies SET updated_at = ? WHERE id = ?').bind(now, existing.company_id).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
