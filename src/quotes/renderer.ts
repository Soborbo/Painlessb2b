import { getTemplate } from './templates';

// Mirrors the prototype's renderPreview: keys that match the `pN_title_em`
// pattern get an `_em_block` companion that wraps the value in <em>…</em>,
// or expands to empty when the value is blank.
const EM_BLOCK_RE = /^(p\d+)_title_em$/;

function buildRenderData(fieldData: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...fieldData };
  for (const [key, value] of Object.entries(fieldData)) {
    const m = EM_BLOCK_RE.exec(key);
    if (m) {
      out[`${m[1]}_title_em_block`] = value ? `<em>${value}</em>` : '';
    }
  }
  return out;
}

// Templates contain {{field_id}} placeholders. Several fields are marked
// "HTML allowed" in meta.json, so values are inserted verbatim — sales
// users author both sides of this boundary, the same trust level as the
// template itself.
export function renderTemplate(
  html: string,
  fieldData: Record<string, string>
): string {
  const data = buildRenderData(fieldData);
  return html.replace(/\{\{(\w+)\}\}/g, (_full, key) => {
    const value = data[key];
    return value === undefined ? '' : value;
  });
}

export function renderQuoteHtml(
  templateId: string,
  fieldData: Record<string, string>
): string | null {
  const entry = getTemplate(templateId);
  if (!entry) return null;

  // Merge defaults under user overrides so a quote that was created before a
  // template added new fields still renders fully.
  const defaults: Record<string, string> = {};
  for (const field of entry.meta.fields) {
    defaults[field.id] = field.default;
  }
  const merged = { ...defaults, ...fieldData };
  return renderTemplate(entry.html, merged);
}
