// One-off / re-runnable: inline external <img src> references in quote
// templates as base64 data URIs. The PDF renderer (Cloudflare Browser
// Rendering) fetches no external resources, so templates must be
// self-contained. Safe to re-run — already-embedded `data:` srcs are skipped.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIME = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  webp: 'image/webp',
};

// template file → { "src attribute value": "absolute source path" }
const JOBS = [
  {
    template: 'src/quote-templates/painless-storage-handout/template.html',
    assets: {
      'logo.svg': 'D:/painlessmerged/Desklodge/logo.svg',
      'qr-storage.png': 'D:/painlessmerged/Desklodge/qr-storage.png',
      'jay.avif': 'D:/painlessmerged/Desklodge/jay.avif',
      'richard.avif': 'D:/painlessmerged/Desklodge/richard.avif',
      'tom.avif': 'D:/painlessmerged/Desklodge/tom.avif',
    },
  },
  {
    template: 'src/quote-templates/knight-frank-premium-brochure/template.html',
    assets: {
      'painless-logo.svg': 'D:/painlessmerged/Knight Frank/painless-logo.svg',
      'images/knight-frank-logo.svg':
        'D:/painlessmerged/Knight Frank/images/knight-frank-logo.svg',
      'images/tier-removal.webp':
        'D:/painlessmerged/Knight Frank/images/tier-removal.webp',
      'images/tier-packing.webp':
        'D:/painlessmerged/Knight Frank/images/tier-packing.webp',
      'images/tier-vip.webp':
        'D:/painlessmerged/Knight Frank/images/tier-vip.webp',
      'images/jay-newton.webp':
        'D:/painlessmerged/Knight Frank/images/jay-newton.webp',
    },
  },
];

function dataUri(absPath) {
  const ext = absPath.split('.').pop().toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unknown asset extension: ${absPath}`);
  const b64 = readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

for (const job of JOBS) {
  const file = resolve(job.template);
  let html = readFileSync(file, 'utf8');
  let changed = 0;
  for (const [srcValue, assetPath] of Object.entries(job.assets)) {
    const needle = `src="${srcValue}"`;
    if (!html.includes(needle)) {
      console.warn(`  ! "${needle}" not found in ${job.template}`);
      continue;
    }
    const uri = dataUri(assetPath);
    const count = html.split(needle).length - 1;
    html = html.split(needle).join(`src="${uri}"`);
    changed += count;
  }
  writeFileSync(file, html);
  console.log(`${job.template}: embedded ${changed} image reference(s)`);
}
