import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';

export const GET: APIRoute = async () => {
  try {
    const { DB: db } = await getCfEnv();

    const [
      statusCounts,
      categoryCounts,
      priorityCounts,
      monthlyCreated,
      monthlyStatusChanges,
      emailStats,
      recentActivity,
      conversionFunnel,
    ] = await Promise.all([
      db.prepare('SELECT status, COUNT(*) as count FROM companies GROUP BY status').all(),
      db.prepare(`
        SELECT COALESCE(cat.name, 'Uncategorised') as name, cat.color, COUNT(*) as count
        FROM companies c LEFT JOIN categories cat ON c.category_id = cat.id
        GROUP BY c.category_id ORDER BY count DESC
      `).all(),
      db.prepare('SELECT priority, COUNT(*) as count FROM companies GROUP BY priority').all(),
      db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
        FROM companies
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY month ORDER BY month
      `).all(),
      db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month, action, COUNT(*) as count
        FROM activity_log
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY month, action ORDER BY month
      `).all(),
      db.prepare('SELECT status, COUNT(*) as count FROM email_log GROUP BY status').all(),
      db.prepare(`
        SELECT al.*, c.name as company_name
        FROM activity_log al
        LEFT JOIN companies c ON al.company_id = c.id
        ORDER BY al.created_at DESC LIMIT 20
      `).all(),
      db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status != 'new' THEN 1 ELSE 0 END) as contacted_plus,
          SUM(CASE WHEN status IN ('follow_up', 'in_conversation', 'partner') THEN 1 ELSE 0 END) as engaged,
          SUM(CASE WHEN status IN ('in_conversation', 'partner') THEN 1 ELSE 0 END) as in_conversation_plus,
          SUM(CASE WHEN status = 'partner' THEN 1 ELSE 0 END) as partners
        FROM companies
      `).all(),
    ]);

    return new Response(JSON.stringify({
      statusCounts: statusCounts.results,
      categoryCounts: categoryCounts.results,
      priorityCounts: priorityCounts.results,
      monthlyCreated: monthlyCreated.results,
      monthlyStatusChanges: monthlyStatusChanges.results,
      emailStats: emailStats.results,
      recentActivity: recentActivity.results,
      conversionFunnel: conversionFunnel.results?.[0] || {},
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
