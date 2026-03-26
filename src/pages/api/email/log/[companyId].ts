import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const db = locals.runtime.env.DB;
  const { companyId } = params;

  const { results } = await db.prepare(
    'SELECT * FROM email_log WHERE company_id = ? ORDER BY sent_at DESC'
  ).bind(companyId).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
