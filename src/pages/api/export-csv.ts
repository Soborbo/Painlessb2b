import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export const GET: APIRoute = async () => {
  try {
    const { DB: db } = await getCfEnv();

    const { results } = await db.prepare(`
      SELECT c.*, cat.name as category_name
      FROM companies c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.updated_at DESC
    `).all();

    const headers = [
      'name', 'category', 'address', 'postcode', 'lat', 'lng',
      'phone', 'website', 'generic_email',
      'contact_name', 'contact_email', 'contact_phone',
      'status', 'priority', 'source', 'source_url',
      'follow_up_date', 'created_at', 'updated_at',
    ];

    // BOM for Excel UTF-8 compatibility
    const rows = ['\uFEFF' + headers.map(escapeCsv).join(',')];

    for (const c of results as any[]) {
      rows.push([
        escapeCsv(c.name),
        escapeCsv(c.category_name),
        escapeCsv(c.address),
        escapeCsv(c.postcode),
        escapeCsv(c.lat != null ? String(c.lat) : ''),
        escapeCsv(c.lng != null ? String(c.lng) : ''),
        escapeCsv(c.phone),
        escapeCsv(c.website),
        escapeCsv(c.generic_email),
        escapeCsv(c.contact_name),
        escapeCsv(c.contact_email),
        escapeCsv(c.contact_phone),
        escapeCsv(c.status),
        escapeCsv(c.priority),
        escapeCsv(c.source),
        escapeCsv(c.source_url),
        escapeCsv(c.follow_up_date),
        escapeCsv(c.created_at),
        escapeCsv(c.updated_at),
      ].join(','));
    }

    return new Response(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
