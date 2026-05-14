import { getTemplate } from './templates';
import { rewriteLinks } from './tracking';

export type FieldEditMode = 'inline' | 'panel';

export interface FieldEditInfo {
  mode: FieldEditMode;
  multiline: boolean;
}

export interface RenderQuoteHtmlOptions {
  /**
   * If set, every <a href> in the rendered HTML is rewritten to route
   * through /r/<token>?u=<base64(original)>. Used for the PDF we attach
   * to outgoing emails; never for the editor preview.
   */
  rewriteLinks?: {
    token: string;
    baseUrl: string; // e.g. "https://painlessb2b.example.workers.dev"
  };
  /**
   * Editor preview only. Wraps each field placeholder that sits in text
   * content in a <span data-qf="…"> marker and appends a small runtime so
   * the proposal can be edited by clicking straight into it. Never set for
   * the PDF or the emailed copy — those must stay free of editor chrome.
   */
  editable?: boolean;
}

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

type FieldClassifier = (fieldId: string) => FieldEditInfo | null;

// A placeholder is "in text position" when the nearest angle bracket before
// it is a `>` (or there is none) — i.e. it is not sitting inside a tag's
// attribute list (e.g. `src="{{…}}"`). Template copy keeps any literal
// `<`/`>` as entities, so a bracket scan is reliable here without a full
// HTML parse.
function isTextPosition(html: string, index: number): boolean {
  return html.lastIndexOf('<', index) <= html.lastIndexOf('>', index);
}

// Templates contain {{field_id}} placeholders. Several fields carry HTML in
// their values (<em>, <strong>, <br>), so values are inserted verbatim —
// sales users author both sides of this boundary, the same trust level as
// the template itself.
//
// When `classify` is supplied (editor preview only), every placeholder that
// resolves to a known field and sits in text content is wrapped in a
// `data-qf` span, so the injected runtime can map a clicked node back to
// the field it came from.
export function renderTemplate(
  html: string,
  fieldData: Record<string, string>,
  classify?: FieldClassifier
): string {
  const data = buildRenderData(fieldData);
  return html.replace(
    /\{\{(\w+)\}\}/g,
    (_full: string, key: string, offset: number, str: string) => {
      const value = data[key];
      if (value === undefined) return '';
      if (!classify) return value;

      // `pN_title_em_block` is synthetic — its editable field is `pN_title_em`.
      const fieldId = key.endsWith('_em_block')
        ? key.slice(0, -'_block'.length)
        : key;
      const info = classify(fieldId);
      if (!info || !isTextPosition(str, offset)) return value;

      const cls = info.mode === 'inline' ? 'qf-f qf-inline' : 'qf-f qf-panel';
      const attrs =
        info.mode === 'inline'
          ? ` contenteditable="true" spellcheck="false"${
              info.multiline ? ' data-qf-ml="1"' : ''
            }`
          : '';
      return `<span class="${cls}" data-qf="${fieldId}"${attrs}>${value}</span>`;
    }
  );
}

export function renderQuoteHtml(
  templateId: string,
  fieldData: Record<string, string>,
  opts: RenderQuoteHtmlOptions = {}
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

  let classify: FieldClassifier | undefined;
  if (opts.editable) {
    const info = new Map<string, FieldEditInfo>();
    for (const field of entry.meta.fields) {
      const val = merged[field.id] ?? '';
      // A value carrying markup can't round-trip through a plain-text
      // contenteditable, so those fields stay panel-only (click-to-focus).
      const mode: FieldEditMode = /[<>]/.test(val) ? 'panel' : 'inline';
      info.set(field.id, { mode, multiline: field.type === 'textarea' });
    }
    classify = (id) => info.get(id) ?? null;
  }

  const rendered = renderTemplate(entry.html, merged, classify);

  if (opts.rewriteLinks) {
    return rewriteLinks(rendered, opts.rewriteLinks.token, opts.rewriteLinks.baseUrl);
  }
  if (opts.editable) {
    return injectEditorRuntime(rendered);
  }
  return rendered;
}

// Appended to the editor preview only. Turns the `data-qf` spans into
// click-to-edit targets and reports changes up to the parent editor via
// postMessage; the parent owns persistence and the side panel. The PDF and
// emailed copies never go through this path, so they stay clean.
function injectEditorRuntime(html: string): string {
  const marker = '</body>';
  const idx = html.lastIndexOf(marker);
  if (idx === -1) return html + EDITOR_RUNTIME;
  return html.slice(0, idx) + EDITOR_RUNTIME + html.slice(idx);
}

const EDITOR_RUNTIME = `
<style>
@media screen {
  .qf-f { outline: 1px dashed transparent; outline-offset: 1px; border-radius: 2px;
    transition: outline-color .12s ease, background-color .12s ease; }
  .qf-f:hover { outline-color: #818cf8; }
  .qf-inline { cursor: text; }
  .qf-inline:focus { outline: 1px solid #6366f1; background: rgba(129,140,248,.10); }
  .qf-inline:empty { display: inline-block; min-width: 2.5em; min-height: 1em;
    background: rgba(129,140,248,.18); }
  .qf-panel { cursor: pointer; }
  .qf-panel:hover { background: rgba(129,140,248,.14); }
}
</style>
<script>
(function () {
  var DEBOUNCE = 350;
  var ORIGIN = location.origin;
  var timers = new WeakMap();
  function send(el) {
    parent.postMessage(
      { type: 'qf-edit', fieldId: el.getAttribute('data-qf'), value: el.innerText },
      ORIGIN
    );
  }
  function schedule(el) {
    var t = timers.get(el);
    if (t) clearTimeout(t);
    timers.set(el, setTimeout(function () { timers.delete(el); send(el); }, DEBOUNCE));
  }
  function flush(el) {
    var t = timers.get(el);
    if (t) { clearTimeout(t); timers.delete(el); }
    send(el);
  }
  var inlines = document.querySelectorAll('.qf-inline');
  for (var i = 0; i < inlines.length; i++) {
    (function (el) {
      el.addEventListener('input', function () { schedule(el); });
      el.addEventListener('blur', function () { flush(el); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && el.getAttribute('data-qf-ml') !== '1') {
          e.preventDefault();
          el.blur();
        }
      });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    })(inlines[i]);
  }
  var panels = document.querySelectorAll('.qf-panel');
  for (var j = 0; j < panels.length; j++) {
    (function (el) {
      el.addEventListener('click', function () {
        parent.postMessage(
          { type: 'qf-focus', fieldId: el.getAttribute('data-qf') },
          ORIGIN
        );
      });
    })(panels[j]);
  }
})();
</script>
`;
