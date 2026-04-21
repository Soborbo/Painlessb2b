import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { generateId } from '../../../lib/utils';
import { STATUSES, PRIORITIES } from '../../../lib/constants';

const MAX_BULK_IDS = 200;

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

  // Validate ids are strings and cap length
  const validIds = ids.filter((id: any) => typeof id === 'string' && id.length > 0).slice(0, MAX_BULK_IDS);
  if (validIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  try {
    if (action === 'update_status' && value) {
      if (!STATUSES.includes(value)) {
        return new Response(JSON.stringify({ error: `Invalid status: ${value}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const stmts = validIds.flatMap((id: string) => [
        db.prepare('UPDATE companies SET status = ?, updated_at = ? WHERE id = ?').bind(value, now, id),
        db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)').bind(generateId(), id, 'status_changed', `Bulk status change to ${value}`),
      ]);
      await db.batch(stmts);
    } else if (action === 'update_category' && value) {
      // Verify category exists
      const cat = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(value).first();
      if (!cat) {
        return new Response(JSON.stringify({ error: 'Category not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const stmts = validIds.flatMap((id: string) => [
        db.prepare('UPDATE companies SET category_id = ?, updated_at = ? WHERE id = ?').bind(value, now, id),
        db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)').bind(generateId(), id, 'category_changed', 'Bulk category change'),
      ]);
      await db.batch(stmts);
    } else if (action === 'update_priority' && value) {
      if (!PRIORITIES.includes(value)) {
        return new Response(JSON.stringify({ error: `Invalid priority: ${value}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const stmts = validIds.flatMap((id: string) => [
        db.prepare('UPDATE companies SET priority = ?, updated_at = ? WHERE id = ?').bind(value, now, id),
        db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)').bind(generateId(), id, 'priority_changed', `Bulk priority change to ${value}`),
      ]);
      await db.batch(stmts);
    } else if (action === 'delete') {
      // Log deletions first, then cascade delete
      const logStmts = validIds.map((id: string) =>
        db.prepare('INSERT INTO activity_log (id, company_id, action, details) VALUES (?, ?, ?, ?)').bind(generateId(), null, 'company_deleted', `Bulk delete: ${id}`)
      );
      await db.batch(logStmts);

      const deleteStmts = validIds.flatMap((id: string) => [
        db.prepare('DELETE FROM notes WHERE company_id = ?').bind(id),
        db.prepare('DELETE FROM email_log WHERE company_id = ?').bind(id),
        db.prepare('DELETE FROM contacts WHERE company_id = ?').bind(id),
        db.prepare('DELETE FROM activity_log WHERE company_id = ?').bind(id),
        db.prepare('DELETE FROM companies WHERE id = ?').bind(id),
      ]);
      await db.batch(deleteStmts);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ affected: validIds.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Bulk operation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
