import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';

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
  if (!body.company_id || !body.body) {
    return new Response(JSON.stringify({ error: 'Missing required fields: company_id, body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const id = generateId();

  await db.prepare(`
    INSERT INTO notes (id, company_id, body) VALUES (?, ?, ?)
  `).bind(id, body.company_id, body.body).run();

  // Update company's updated_at
  await db.prepare(`UPDATE companies SET updated_at = datetime('now') WHERE id = ?`).bind(body.company_id).run();

  const note = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify(note), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
