/**
 * Post-build script to restructure the Astro Cloudflare adapter output
 * for Cloudflare Pages compatibility.
 *
 * The adapter generates:
 *   dist/client/  — static assets
 *   dist/server/  — worker code (entry.mjs + chunks/)
 *
 * Cloudflare Pages expects:
 *   dist/         — static assets at the root
 *   dist/_worker.js/  — worker entry point
 *
 * This script copies server files into dist/client/_worker.js/ and
 * patches the generated wrangler.json to remove Workers-only fields.
 */
import { cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');

// 1. Copy server entry + chunks into dist/client/_worker.js/
const workerDir = resolve(distDir, 'client/_worker.js');
mkdirSync(workerDir, { recursive: true });
cpSync(resolve(distDir, 'server/entry.mjs'), resolve(workerDir, 'index.js'));
cpSync(resolve(distDir, 'server/chunks'), resolve(workerDir, 'chunks'), { recursive: true });
// Copy middleware and any other .mjs files at server root
import { readdirSync } from 'node:fs';
for (const file of readdirSync(resolve(distDir, 'server'))) {
  if (file.endsWith('.mjs') && file !== 'entry.mjs') {
    cpSync(resolve(distDir, 'server', file), resolve(workerDir, file));
  }
}

// 2. Fix wrangler.json — remove Workers-only fields that Pages rejects
const wranglerPath = resolve(distDir, 'server/wrangler.json');
const config = JSON.parse(readFileSync(wranglerPath, 'utf-8'));

delete config.main;
delete config.rules;
delete config.assets;
delete config.no_bundle;
delete config.triggers;

writeFileSync(wranglerPath, JSON.stringify(config));
console.log('Restructured build output for Cloudflare Pages.');
