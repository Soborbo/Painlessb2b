import type { TemplateMeta, TemplateSummary } from './types';

// Built-in templates. To add a new template:
//   1. Drop `src/quote-templates/<id>/template.html` + `meta.json` into the repo
//   2. Add an entry to TEMPLATE_REGISTRY below
// See docs/adding-a-template.md for the full recipe.
import logisticsProposalHtml from '../quote-templates/logistics-proposal/template.html?raw';
import logisticsProposalMeta from '../quote-templates/logistics-proposal/meta.json';

interface RegistryEntry {
  meta: TemplateMeta;
  html: string;
}

const TEMPLATE_REGISTRY: Record<string, RegistryEntry> = {
  'logistics-proposal': {
    meta: logisticsProposalMeta as TemplateMeta,
    html: logisticsProposalHtml,
  },
};

export function listTemplates(): TemplateSummary[] {
  return Object.values(TEMPLATE_REGISTRY).map(({ meta }) => ({
    id: meta.id,
    name: meta.name,
    field_count: meta.fields.length,
  }));
}

export function getTemplate(id: string): RegistryEntry | null {
  return TEMPLATE_REGISTRY[id] ?? null;
}

export function getTemplateMeta(id: string): TemplateMeta | null {
  return TEMPLATE_REGISTRY[id]?.meta ?? null;
}

export function getDefaultFieldData(id: string): Record<string, string> {
  const meta = getTemplateMeta(id);
  if (!meta) return {};
  const out: Record<string, string> = {};
  for (const field of meta.fields) {
    out[field.id] = field.default;
  }
  return out;
}
