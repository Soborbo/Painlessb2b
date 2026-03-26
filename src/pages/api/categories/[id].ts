import type { APIRoute } from 'astro';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const { id } = params;
  const body = await request.json();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    fields.push('name = ?');
    values.push(body.name);
  }
  if (body.color !== undefined) {
    fields.push('color = ?');
    values.push(body.color);
  }

  if (fields.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  values.push(id);
  await db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify(category), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const { id } = params;

  // Check if any companies use this category
  const count = await db.prepare(
    'SELECT COUNT(*) as c FROM companies WHERE category_id = ?'
  ).bind(id).first<{ c: number }>();

  if (count && count.c > 0) {
    return new Response(
      JSON.stringify({ error: 'Cannot delete category with associated companies' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
