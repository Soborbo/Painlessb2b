import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';
import { generateId } from '../../lib/utils';
import { SITE_CONFIG } from '../../lib/site-config';

const VALID_STATUSES = ['new', 'contacted', 'follow_up', 'in_conversation', 'partner', 'rejected', 'not_interested'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// Max 10MB CSV
const MAX_CSV_SIZE = 10 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();

  const contentType = request.headers.get('content-type') || '';
  let csvText: string;

  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    csvText = await request.text();
  } else {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      csvText = await file.text();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (csvText.length > MAX_CSV_SIZE) {
    return new Response(JSON.stringify({ error: 'CSV file exceeds 10MB limit' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return new Response(JSON.stringify({ error: 'CSV must have a header row and at least one data row' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const nameIdx = headers.indexOf('name');

  if (nameIdx === -1) {
    return new Response(JSON.stringify({ error: 'CSV must have a "name" column' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let imported = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = fields[idx] || '';
      });

      const name = row.name;
      if (!name) { errored++; continue; }

      const postcode = row.postcode || '';
      // Duplicate check
      if (postcode) {
        const existing = await db.prepare(
          'SELECT id FROM companies WHERE LOWER(name) = LOWER(?) AND LOWER(postcode) = LOWER(?)'
        ).bind(name, postcode).first();
        if (existing) { skipped++; continue; }
      } else {
        const existing = await db.prepare(
          "SELECT id FROM companies WHERE LOWER(name) = LOWER(?) AND (postcode IS NULL OR postcode = '')"
        ).bind(name).first();
        if (existing) { skipped++; continue; }
      }

      // Resolve category
      let categoryId: string | null = null;
      const catName = row.category;
      if (catName) {
        const cat = await db.prepare(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)'
        ).bind(catName).first();
        if (cat) {
          categoryId = (cat as any).id;
        } else {
          categoryId = generateId();
          await db.prepare(
            'INSERT OR IGNORE INTO categories (id, name, color) VALUES (?, ?, ?)'
          ).bind(categoryId, catName, SITE_CONFIG.defaultCategoryColor).run();
          // Re-fetch in case INSERT OR IGNORE hit a conflict
          const fetched = await db.prepare(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)'
          ).bind(catName).first();
          if (fetched) categoryId = (fetched as any).id;
        }
      }

      const companyId = generateId();
      const now = new Date().toISOString();
      const rawLat = parseFloat(row.lat);
      const rawLng = parseFloat(row.lng);
      const lat = !isNaN(rawLat) ? rawLat : null;
      const lng = !isNaN(rawLng) ? rawLng : null;

      // Validate status and priority
      const status = VALID_STATUSES.includes(row.status) ? row.status : 'new';
      const priority = VALID_PRIORITIES.includes(row.priority) ? row.priority : 'medium';

      await db.prepare(`
        INSERT INTO companies (id, name, category_id, address, postcode, lat, lng, phone, website, generic_email, contact_name, contact_email, contact_phone, status, priority, source, source_url, follow_up_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        name,
        categoryId,
        row.address || null,
        postcode || null,
        lat,
        lng,
        row.phone || null,
        row.website || null,
        row.generic_email || null,
        row.contact_name || null,
        row.contact_email || null,
        row.contact_phone || null,
        status,
        priority,
        row.source || null,
        row.source_url || null,
        row.follow_up_date || null,
        now,
        now
      ).run();

      imported++;
    } catch {
      errored++;
    }
  }

  return new Response(JSON.stringify({ imported, skipped, errored, total: lines.length - 1 }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
