import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  const db = (env as any).DB;

  const [companies, categories, notes, emailLog] = await Promise.all([
    db.prepare(`
      SELECT c.*, cat.name as category_name, cat.color as category_color
      FROM companies c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.updated_at DESC
    `).all(),
    db.prepare('SELECT * FROM categories ORDER BY name').all(),
    db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM email_log ORDER BY sent_at DESC').all(),
  ]);

  return new Response(JSON.stringify({
    companies: companies.results,
    categories: categories.results,
    notes: notes.results,
    email_log: emailLog.results,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
