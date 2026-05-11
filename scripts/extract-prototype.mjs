#!/usr/bin/env node
/**
 * One-shot: extract DEFAULT_DATA / FIELD_GROUPS / PROPOSAL_TEMPLATE from
 * docs/prototypes/painless-proposal-editor.html and write them into
 * src/quote-templates/logistics-proposal/ as template.html + meta.json.
 *
 * Run with: node scripts/extract-prototype.mjs
 *
 * Re-runnable. Will overwrite the destination files.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'docs/prototypes/painless-proposal-editor.html');
const OUT_DIR = resolve(ROOT, 'src/quote-templates/logistics-proposal');
const OUT_TEMPLATE = resolve(OUT_DIR, 'template.html');
const OUT_META = resolve(OUT_DIR, 'meta.json');

const html = readFileSync(SRC, 'utf8');

// The prototype declares three top-level JS constants. We pull each out by
// finding the `const NAME = <literal>;` pattern and then evaluating the
// literal in an isolated context.
function extractJsLiteral(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*`, 'g');
  const m = re.exec(html);
  if (!m) throw new Error(`Could not find const ${name} in prototype`);
  const start = m.index + m[0].length;

  let i = start;
  const first = html[i];
  let end;
  if (first === '"' || first === "'") {
    const quote = first;
    i++;
    while (i < html.length) {
      if (html[i] === '\\') { i += 2; continue; }
      if (html[i] === quote) { end = i + 1; break; }
      i++;
    }
  } else if (first === '{' || first === '[') {
    const open = first;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let strCh = '';
    while (i < html.length) {
      const c = html[i];
      if (inStr) {
        if (c === '\\') { i += 2; continue; }
        if (c === strCh) inStr = false;
      } else {
        if (c === '"' || c === "'") { inStr = true; strCh = c; }
        else if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      i++;
    }
  } else {
    throw new Error(`Unexpected literal start for ${name}: ${first}`);
  }
  if (end === undefined) throw new Error(`Unterminated literal for ${name}`);

  const literal = html.slice(start, end);
  return Function(`"use strict"; return (${literal});`)();
}

const DEFAULT_DATA = extractJsLiteral('DEFAULT_DATA');
const FIELD_GROUPS = extractJsLiteral('FIELD_GROUPS');
const PROPOSAL_TEMPLATE = extractJsLiteral('PROPOSAL_TEMPLATE');

// Compose meta.json from FIELD_GROUPS + DEFAULT_DATA.
const fields = [];
for (const group of FIELD_GROUPS) {
  for (const [id, label, type] of group.fields) {
    fields.push({
      id,
      label,
      group: group.title,
      type,
      default: Object.prototype.hasOwnProperty.call(DEFAULT_DATA, id)
        ? DEFAULT_DATA[id]
        : '',
    });
  }
}

const meta = {
  id: 'logistics-proposal',
  name: 'Logistics Proposal',
  default_subject: 'Logistics proposal from Painless Removals',
  default_body:
    "Hi {{recipient_first_name}},\n\n" +
    "Please find attached our logistics proposal. Let me know if you'd " +
    "like to talk anything through.\n\n" +
    'Thanks,\n{{sender_name}}',
  fields,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_TEMPLATE, PROPOSAL_TEMPLATE, 'utf8');
writeFileSync(OUT_META, JSON.stringify(meta, null, 2) + '\n', 'utf8');

const tmplLines = PROPOSAL_TEMPLATE.split('\n').length;
console.log(`template.html: ${PROPOSAL_TEMPLATE.length} bytes (${tmplLines} lines)`);
console.log(`meta.json: ${fields.length} fields across ${FIELD_GROUPS.length} groups`);
