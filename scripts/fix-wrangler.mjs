/**
 * Post-build script to fix the auto-generated wrangler.json for Cloudflare Pages compatibility.
 *
 * The @astrojs/cloudflare adapter generates fields that are invalid for Pages:
 * - "triggers": {} — Pages expects only { crons: [...] } or omit entirely
 * - "assets.binding": "ASSETS" — reserved name in Pages projects
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../dist/server/wrangler.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf-8'));

// Remove empty triggers object
if (config.triggers && Object.keys(config.triggers).length === 0) {
  delete config.triggers;
}

// Rename reserved ASSETS binding
if (config.assets?.binding === 'ASSETS') {
  config.assets.binding = 'STATIC_ASSETS';
}

writeFileSync(path, JSON.stringify(config));
console.log('Fixed dist/server/wrangler.json for Pages compatibility.');
