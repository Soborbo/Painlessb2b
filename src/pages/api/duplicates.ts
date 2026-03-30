import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

// Cap companies for O(n^2) safety
const MAX_COMPANIES_FOR_DUPLICATE_CHECK = 2000;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { DB: db } = await getCfEnv();
    const url = new URL(request.url);
    const rawThreshold = parseFloat(url.searchParams.get('threshold') || '0.7');
    const threshold = isNaN(rawThreshold) ? 0.7 : Math.max(0.5, Math.min(0.99, rawThreshold));

    const { results } = await db.prepare(
      `SELECT id, name, postcode, address FROM companies ORDER BY name LIMIT ${MAX_COMPANIES_FOR_DUPLICATE_CHECK}`
    ).all();

    const companies = (results as any[]).filter((c) => c.name);

    const duplicates: { a: any; b: any; score: number }[] = [];

    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        const a = companies[i];
        const b = companies[j];

        // Quick pre-filter: first 3 normalized chars must share at least 1
        const na = normalise(a.name);
        const nb = normalise(b.name);
        if (na.length > 3 && nb.length > 3 && na.slice(0, 3) !== nb.slice(0, 3)) continue;

        let score = similarity(a.name, b.name);

        // Boost score if postcodes match
        if (a.postcode && b.postcode && normalise(a.postcode) === normalise(b.postcode)) {
          score = Math.min(1, score + 0.15);
        }

        if (score >= threshold) {
          duplicates.push({
            a: { id: a.id, name: a.name, postcode: a.postcode, address: a.address },
            b: { id: b.id, name: b.name, postcode: b.postcode, address: b.address },
            score: Math.round(score * 100) / 100,
          });
        }
      }
    }

    duplicates.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify(duplicates.slice(0, 50)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to check for duplicates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
