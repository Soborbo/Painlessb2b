// One-off / re-runnable: inline each <img> in a quote template with a
// base64 data URI built from a known asset on disk. The PDF renderer
// (Cloudflare Browser Rendering) fetches no external resources, so
// templates must be self-contained.
//
// Raster sources are downscaled with sharp before embedding (the upstream
// brochure images are full-resolution stock photos — embedding them at
// native size bloated the rendered PDF roughly 10×). SVGs pass through.
//
// Each img is identified by a unique attribute signature (`alt` or
// `class`) rather than by its current `src`, so the script is idempotent:
// it doesn't matter whether the current src is the original relative path
// or an already-embedded data URI — the next run produces a fresh
// (downscaled) one.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import sharp from 'sharp';

const MIME = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  webp: 'image/webp',
};

const ENCODE = {
  jpg: (img) => img.jpeg({ quality: 82, mozjpeg: true }),
  jpeg: (img) => img.jpeg({ quality: 82, mozjpeg: true }),
  png: (img) => img.png({ compressionLevel: 9 }),
  webp: (img) => img.webp({ quality: 78 }),
  avif: (img) => img.avif({ quality: 55 }),
};

// `match` is a regex that captures the <img> tag's `src="..."` portion
// in group 1, so the replacement just rewrites group 1. `maxWidth` caps
// raster width (longest edge, css px); pick ~2× the largest on-page
// display width. Omit for SVGs.
const JOBS = [
  {
    template: 'src/quote-templates/painless-storage-handout/template.html',
    assets: [
      {
        file: 'D:/painlessmerged/Desklodge/logo.svg',
        match: /<img\s+(class="brand"\s+)?src="([^"]*)"(\s+class="brand")?\s+alt="Painless Removals">/g,
      },
      {
        file: 'D:/painlessmerged/Desklodge/qr-storage.png',
        match: /<img\s+src="([^"]*)"\s+alt="QR code to painlessremovals\.com\/storage-service\/">/g,
        maxWidth: 320,
      },
      {
        file: 'D:/painlessmerged/Desklodge/jay.avif',
        match: /<img\s+src="([^"]*)"\s+alt="Jay">/g,
        maxWidth: 200,
      },
      {
        file: 'D:/painlessmerged/Desklodge/richard.avif',
        match: /<img\s+src="([^"]*)"\s+alt="Richard">/g,
        maxWidth: 200,
      },
      {
        file: 'D:/painlessmerged/Desklodge/tom.avif',
        match: /<img\s+src="([^"]*)"\s+alt="Tom">/g,
        maxWidth: 200,
      },
    ],
  },
  {
    template: 'src/quote-templates/knight-frank-premium-brochure/template.html',
    assets: [
      // painless-logo appears twice with different class= — header and footer.
      {
        file: 'D:/painlessmerged/Knight Frank/painless-logo.svg',
        match: /<img\s+src="([^"]*)"\s+alt="Painless Removals Bristol"\s+class="(top-logo|logo)"\s*\/>/g,
      },
      {
        file: 'D:/painlessmerged/Knight Frank/images/knight-frank-logo.svg',
        match: /<img\s+src="([^"]*)"\s+alt="Knight Frank"\s+class="kf-logo"\s*\/>/g,
      },
      {
        file: 'D:/painlessmerged/Knight Frank/images/tier-removal.webp',
        match: /<img\s+src="([^"]*)"\s+alt="Painless Removals crew loading a van in Bristol"\s+loading="lazy"\s*\/>/g,
        maxWidth: 800,
      },
      {
        file: 'D:/painlessmerged/Knight Frank/images/tier-packing.webp',
        match: /<img\s+src="([^"]*)"\s+alt="Painless Removals professional packing service"\s+loading="lazy"\s*\/>/g,
        maxWidth: 800,
      },
      {
        file: 'D:/painlessmerged/Knight Frank/images/tier-vip.webp',
        match: /<img\s+src="([^"]*)"\s+alt="Painless Removals VIP concierge service"\s+loading="lazy"\s*\/>/g,
        maxWidth: 800,
      },
      {
        file: 'D:/painlessmerged/Knight Frank/images/jay-newton.webp',
        match: /<img\s+src="([^"]*)"\s+alt="Jay Newton, Director, Painless Removals"\s*\/>/g,
        maxWidth: 200,
      },
    ],
  },
];

async function buildDataUri(asset) {
  const ext = extname(asset.file).slice(1).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unknown asset extension: ${asset.file}`);
  if (ext === 'svg' || asset.maxWidth == null) {
    return `data:${mime};base64,${readFileSync(asset.file).toString('base64')}`;
  }
  const buf = await sharp(asset.file)
    .resize({ width: asset.maxWidth, withoutEnlargement: true })
    .pipe(ENCODE[ext](sharp()))
    .toBuffer();
  return `data:${mime};base64,${buf.toString('base64')}`;
}

for (const job of JOBS) {
  const file = resolve(job.template);
  const sizeBefore = readFileSync(file).length;
  let html = readFileSync(file, 'utf8');
  for (const asset of job.assets) {
    const dataUri = await buildDataUri(asset);
    let hits = 0;
    html = html.replace(asset.match, (tag, currentSrc) => {
      hits++;
      return tag.replace(`src="${currentSrc}"`, `src="${dataUri}"`);
    });
    if (hits === 0) {
      console.warn(`  ! no <img> matched for ${asset.file}`);
    } else {
      console.log(`  ${asset.file.split(/[\\/]/).pop()} → ${hits} ref(s)`);
    }
  }
  writeFileSync(file, html);
  const sizeAfter = readFileSync(file).length;
  console.log(
    `${job.template}: ${(sizeBefore / 1024).toFixed(0)}KB → ${(sizeAfter / 1024).toFixed(0)}KB ` +
      `(${(((sizeAfter - sizeBefore) / sizeBefore) * 100).toFixed(0)}%)`
  );
}
