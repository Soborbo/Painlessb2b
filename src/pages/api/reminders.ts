import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';

export const GET: APIRoute = async () => {
  const { DB: db } = await getCfEnv();

  const { results } = await db.prepare(`
    SELECT c.*, cat.name as category_name, cat.color as category_color
    FROM companies c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.follow_up_date <= datetime('now')
      AND c.status NOT IN ('partner', 'rejected', 'not_interested')
    ORDER BY c.follow_up_date ASC
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
