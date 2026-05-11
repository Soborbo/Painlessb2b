# Adding a new quote template

Quote templates are file-based. Adding one does not require any DB
migration or schema change — just three steps:

## 1. Create the template directory

```
src/quote-templates/<template-id>/
  template.html
  meta.json
```

Pick a kebab-case `template-id` that doesn't collide with existing ones.
The id appears in URLs and in the `quotes.template_id` column.

## 2. `template.html`

The HTML you want rendered as a PDF. Anything goes — embed CSS, fonts
(as data URIs), images (as data URIs or `<svg>` inline). The PDF
renderer (Cloudflare Browser Rendering) runs Chromium and fetches no
external resources at render time, so the HTML must be self-contained.

Sales-editable text uses `{{field_id}}` Mustache-style placeholders.
Each placeholder is replaced at render time with the matching value from
the quote's `field_data`. Unknown placeholders expand to empty.

Two render-time conventions inherited from the Logistics Proposal
prototype:

- HTML in field values is inserted **verbatim** (not escaped). Several
  fields are explicitly marked `"HTML allowed"` in their label. Sales
  users author both the template and the values, so the trust boundary
  is the same.
- Field ids matching `p\d+_title_em` (e.g. `p1_title_em`) get an
  auto-generated companion `p1_title_em_block` that wraps the value in
  `<em>…</em>` only when non-empty. Use the `_block` variant in markup
  if you want the em-tag to disappear cleanly when the field is blank.
  Other templates can ignore this; it's a no-op when no such fields
  exist.

## 3. `meta.json`

Defines the editable fields the sales user sees:

```jsonc
{
  "id": "logistics-proposal",
  "name": "Logistics Proposal",
  "default_subject": "Logistics proposal from Painless Removals",
  "default_body": "Hi {{recipient_first_name}}, ...",
  "fields": [
    {
      "id": "client_name",
      "label": "Client name",
      "group": "Header",
      "type": "text",
      "default": "ACME Logistics"
    },
    {
      "id": "intro_paragraph",
      "label": "Intro paragraph",
      "group": "Introduction",
      "type": "textarea",
      "default": "We're delighted to..."
    }
  ]
}
```

Field props:

| Key | Notes |
| --- | --- |
| `id` | Matches a `{{id}}` placeholder in `template.html` |
| `label` | Shown next to the input in the editor |
| `group` | Group accordion title; fields share a group are rendered together in the order they appear in `meta.json` |
| `type` | `"text"` (single line) or `"textarea"` (multi-line) |
| `default` | Verbatim default text. Preserve brand-approved wording exactly |

Top-level `default_subject` / `default_body` are the email defaults shown
in the send modal. They can themselves use `{{field_id}}` placeholders
plus the runtime-only `{{recipient_first_name}}` / `{{sender_name}}`.

## 4. Register the template

Open `src/quotes/templates.ts` and add an entry to `TEMPLATE_REGISTRY`:

```ts
import myTemplateHtml from '../quote-templates/my-template/template.html?raw';
import myTemplateMeta from '../quote-templates/my-template/meta.json';

const TEMPLATE_REGISTRY: Record<string, RegistryEntry> = {
  'logistics-proposal': { /* existing */ },
  'my-template': {
    meta: myTemplateMeta as TemplateMeta,
    html: myTemplateHtml,
  },
};
```

The `?raw` import inlines the HTML at build time, so the Worker has
zero-cost access at runtime.

## 5. Deploy

`npm run deploy` rebuilds and ships. The template appears immediately
on the `/quotes/new` template picker. Old quotes built with previous
templates keep working: their `field_data` is stored as JSON, and
unknown fields render empty rather than failing.

## Pixel guardrails for Samsung Android PDF readers

The Samsung built-in PDF viewer is the most fragile target. To keep
output safe across readers:

- Avoid `opacity` and `mix-blend-mode` (Samsung renders these
  incorrectly)
- Don't rely on `@page` rules beyond `size: A4`; the Browser Rendering
  pdf() call sets format explicitly
- Use embedded fonts (as data URIs) — no external `<link>` to Google
  Fonts
- All images: data URIs or inline `<svg>`
- Test by emailing a real PDF to a Samsung phone before declaring the
  template done
