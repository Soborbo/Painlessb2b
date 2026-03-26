import type { APIRoute } from 'astro';
import { generateId } from '../../../lib/utils';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;

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

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const body = await request.json();
  const id = generateId();

  await db.prepare(`
    INSERT INTO categories (id, name, color) VALUES (?, ?, ?)
  `).bind(id, body.name, body.color || '#6366f1').run();

  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify(category), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
