/**
 * Post-build script to fix the auto-generated wrangler.json for Cloudflare Pages compatibility.
 *
 * The @astrojs/cloudflare adapter generates a Workers-style wrangler.json that contains
 * fields incompatible with Pages deployments. This script strips them out.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../dist/server/wrangler.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf-8'));

// Remove fields that are not supported by Pages projects
delete config.main;
delete config.rules;
delete config.assets;
delete config.no_bundle;
delete config.triggers;

writeFileSync(path, JSON.stringify(config));
console.log('Fixed dist/server/wrangler.json for Pages compatibility.');
