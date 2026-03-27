import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';
import { SITE_CONFIG } from '../../../lib/site-config';

export const GET: APIRoute = async () => {
  const { DB: db } = await getCfEnv();

  const { results } = await db.prepare(`
    SELECT cat.*, COUNT(c.id) as company_count
    FROM categories cat
    LEFT JOIN companies c ON c.category_id = cat.id
    GROUP BY cat.id
    ORDER BY cat.name
  `).all();

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
    return new Response(JSON.stringify({ error: 'Category name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const id = generateId();

  await db.prepare(`
    INSERT INTO categories (id, name, color) VALUES (?, ?, ?)
  `).bind(id, body.name, body.color || SITE_CONFIG.defaultCategoryColor).run();

  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify(category), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
