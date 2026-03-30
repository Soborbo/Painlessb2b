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

  const { ids, action, value } = body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return new Response(JSON.stringify({ error: 'ids (array) and action are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  let affected = 0;

  if (action === 'update_status' && value) {
    for (const id of ids) {
      await db.prepare('UPDATE companies SET status = ?, updated_at = ? WHERE id = ?')
        .bind(value, now, id).run();
      // Log activity
      await db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, 'status_changed', `Bulk status change to ${value}`).run();
      affected++;
    }
  } else if (action === 'update_category' && value) {
    for (const id of ids) {
      await db.prepare('UPDATE companies SET category_id = ?, updated_at = ? WHERE id = ?')
        .bind(value, now, id).run();
      await db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, 'category_changed', `Bulk category change`).run();
      affected++;
    }
  } else if (action === 'update_priority' && value) {
    for (const id of ids) {
      await db.prepare('UPDATE companies SET priority = ?, updated_at = ? WHERE id = ?')
        .bind(value, now, id).run();
      await db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, 'priority_changed', `Bulk priority change to ${value}`).run();
      affected++;
    }
  } else if (action === 'delete') {
    for (const id of ids) {
      await db.prepare('DELETE FROM notes WHERE company_id = ?').bind(id).run();
      await db.prepare('DELETE FROM email_log WHERE company_id = ?').bind(id).run();
      await db.prepare('DELETE FROM activity_log WHERE company_id = ?').bind(id).run();
      await db.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();
      affected++;
    }
  } else {
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ affected }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
