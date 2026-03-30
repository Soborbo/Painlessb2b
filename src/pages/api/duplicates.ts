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

export const GET: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  const url = new URL(request.url);
  const threshold = parseFloat(url.searchParams.get('threshold') || '0.7');

  const { results: companies } = await db.prepare(
    'SELECT id, name, postcode, address FROM companies ORDER BY name'
  ).all();

  const duplicates: { a: any; b: any; score: number }[] = [];

  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i];
      const b = companies[j];

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
};
