import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateId } from '../../lib/utils';

export const POST: APIRoute = async ({ request }) => {
  const db = (env as any).DB;
  const prospects = await request.json();

  if (!Array.isArray(prospects)) {
    return new Response(JSON.stringify({ error: 'Expected JSON array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let imported = 0;
  let skipped = 0;

  for (const p of prospects) {
    // Duplicate check: same name + postcode
    if (p.name && p.postcode) {
      const existing = await db.prepare(
        'SELECT id FROM companies WHERE LOWER(name) = LOWER(?) AND LOWER(postcode) = LOWER(?)'
      ).bind(p.name, p.postcode).first();

      if (existing) {
        skipped++;
        continue;
      }
    }

    // Resolve or create category
    let categoryId: string | null = null;
    if (p.category) {
      const cat = await db.prepare(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)'
      ).bind(p.category).first<{ id: string }>();

      if (cat) {
        categoryId = cat.id;
      } else {
        categoryId = generateId();
        await db.prepare(
          'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)'
        ).bind(categoryId, p.category, '#6366f1').run();
      }
    }

    const companyId = generateId();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO companies (id, name, category_id, address, postcode, lat, lng, phone, website, generic_email, contact_name, contact_email, contact_phone, status, priority, source, source_url, google_place_id, follow_up_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      companyId,
      p.name,
      categoryId,
      p.address || null,
      p.postcode || null,
      p.lat || null,
      p.lng || null,
      p.phone || null,
      p.website || null,
      p.generic_email || null,
      p.contact_name || null,
      p.contact_email || null,
      p.contact_phone || null,
      p.status || 'new',
      p.priority || 'medium',
      p.source || null,
      p.source_url || null,
      p.google_place_id || null,
      p.follow_up_date || null,
      now,
      now
    ).run();

    // Create note from notes field
    if (p.notes) {
      await db.prepare(
        'INSERT INTO notes (id, company_id, body) VALUES (?, ?, ?)'
      ).bind(generateId(), companyId, p.notes).run();
    }

    imported++;
  }

  return new Response(JSON.stringify({ imported, skipped, total: prospects.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
