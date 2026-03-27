import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';

export const GET: APIRoute = async ({ params }) => {
  const { DB: db } = await getCfEnv();
  const { companyId } = params;

  const { results } = await db.prepare(
    'SELECT * FROM email_log WHERE company_id = ? ORDER BY sent_at DESC'
  ).bind(companyId).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
