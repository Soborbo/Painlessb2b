import puppeteer from '@cloudflare/puppeteer';
import type { TemplateMeta } from './types';

// Cloudflare Browser Rendering binding type. Worker-types declares this on
// the BrowserWorker interface but the shape is opaque — Fetcher works.
type BrowserBinding = Fetcher;

export interface RenderOptions {
  // Sales user has marked tracking off → preview/sent PDF should be plain.
  // No-op for now; placeholder for M6 when link-rewrite lands.
  trackingEnabled?: boolean;
}

export class PdfRenderError extends Error {
  constructor(public reason: string, public detail?: string) {
    super(reason);
  }
}

const MIN_PDF_BYTES = 30_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MIN_BODY_TEXT_CHARS = 800;

export async function renderQuotePdf(
  browser: BrowserBinding,
  html: string,
  meta: TemplateMeta,
  fieldData: Record<string, string>,
  _opts: RenderOptions = {}
): Promise<Uint8Array> {
  validateRequiredFields(meta, fieldData);

  const session = await puppeteer.launch(browser);
  try {
    const page = await session.newPage();
    // Browser Rendering's default viewport is 800px wide. Templates carry an
    // `@media (max-width:850px)` rule that scales `.page` down for narrow
    // on-screen preview — at 800px that rule matches *inside* page.pdf() and
    // produces a shrunken proposal floating in a mostly-blank A4 sheet. Force
    // a viewport wider than any template's mobile breakpoint so only the base
    // + `@media print` styles apply to the printed output.
    await page.setViewport({ width: 1240, height: 1754 });
    // Template HTML is self-contained (embedded fonts/images as data URIs),
    // so 'load' is sufficient; networkidle0 would just add latency for the
    // sake of waiting on requests that will never fire.
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });

    const bodyText: string = await page.evaluate(
      () => document.body?.innerText ?? ''
    );
    if (bodyText.length < MIN_BODY_TEXT_CHARS) {
      throw new PdfRenderError(
        'render_empty',
        `Rendered body has only ${bodyText.length} chars (< ${MIN_BODY_TEXT_CHARS})`
      );
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      // Margins live in the template's .page CSS, not the wrapper —
      // setting margin: 0 here keeps the A4 page the renderer produces
      // matching what the editor iframe shows.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      waitForFonts: true,
      timeout: 20_000,
    });

    const bytes = new Uint8Array(pdfBuffer);
    if (bytes.byteLength < MIN_PDF_BYTES) {
      throw new PdfRenderError(
        'render_too_small',
        `PDF is ${bytes.byteLength} bytes (< ${MIN_PDF_BYTES})`
      );
    }
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new PdfRenderError(
        'render_too_large',
        `PDF is ${bytes.byteLength} bytes (> ${MAX_PDF_BYTES})`
      );
    }
    return bytes;
  } finally {
    await session.close();
  }
}

function validateRequiredFields(
  meta: TemplateMeta,
  fieldData: Record<string, string>
): void {
  const missing: string[] = [];
  for (const field of meta.fields) {
    if (!field.required) continue;
    const v = fieldData[field.id];
    if (!v || v.trim() === '') missing.push(field.id);
  }
  if (missing.length > 0) {
    throw new PdfRenderError(
      'missing_required_fields',
      `Required fields not set: ${missing.join(', ')}`
    );
  }
}
