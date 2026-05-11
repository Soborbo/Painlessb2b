import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../../lib/cf-env';
import {
  getQuote,
  updateQuote,
  markSent,
  recordEvent,
} from '../../../../quotes/db';
import { getTemplate } from '../../../../quotes/templates';
import { renderQuoteHtml } from '../../../../quotes/renderer';
import { renderQuotePdf, PdfRenderError } from '../../../../quotes/pdf';
import {
  sendQuoteEmail,
  SendError,
  SENDER_ALIAS_CONFIG,
  buildSubjectAndBody,
} from '../../../../quotes/send';
import { SENDER_ALIASES } from '../../../../quotes/types';
import type { SenderAlias } from '../../../../quotes/types';
import { generateId } from '../../../../lib/utils';

function jsonError(status: number, error: string, detail?: string) {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  const cfEnv = await getCfEnv();
  const id = params.id;
  if (!id) return jsonError(400, 'Missing id');

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const to = String(body.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return jsonError(400, 'invalid_recipient', 'to must be a valid email');
  }
  const alias = body.from_alias;
  if (!alias || !(SENDER_ALIASES as readonly string[]).includes(alias)) {
    return jsonError(400, 'invalid_sender_alias', `Must be one of ${SENDER_ALIASES.join(', ')}`);
  }
  const subject = body.subject ? String(body.subject).trim() : '';
  const messageBody = body.message_body ? String(body.message_body) : '';
  const ccMe = !!body.cc_me;
  const trackingEnabledOverride = body.tracking_enabled;
  const recipientName = body.recipient_name ? String(body.recipient_name) : null;

  const quote = await getQuote(cfEnv.DB, id);
  if (!quote) return jsonError(404, 'Not found');
  if (quote.status !== 'draft') {
    return jsonError(409, 'not_a_draft', `Cannot send a quote in status ${quote.status}`);
  }

  const entry = getTemplate(quote.template_id);
  if (!entry) return jsonError(500, 'template_missing');

  if (!cfEnv.BROWSER) return jsonError(500, 'browser_binding_missing');
  if (!cfEnv.QUOTE_PDFS) return jsonError(500, 'r2_binding_missing');
  const apiKey = cfEnv.RESEND_API_KEY as string | undefined;
  if (!apiKey) return jsonError(500, 'resend_not_configured');

  // Persist the send-time choices on the quote BEFORE we attempt to send,
  // so that a partial failure still leaves the editor reflecting what the
  // user typed.
  const trackingEnabled =
    typeof trackingEnabledOverride === 'boolean'
      ? trackingEnabledOverride
      : quote.tracking_enabled;
  await updateQuote(cfEnv.DB, id, {
    recipient_email: to,
    recipient_name: recipientName,
    sender_alias: alias as SenderAlias,
    subject: subject || null,
    message_body: messageBody || null,
    tracking_enabled: trackingEnabled,
  });
  const refreshed = (await getQuote(cfEnv.DB, id))!;

  const { subject: finalSubject, body: finalBody } = buildSubjectAndBody(
    refreshed,
    entry.meta.default_subject,
    entry.meta.default_body
  );

  const html = renderQuoteHtml(refreshed.template_id, refreshed.field_data);
  if (!html) return jsonError(500, 'render_failed');

  // 1. Render PDF
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderQuotePdf(
      cfEnv.BROWSER as any,
      html,
      entry.meta,
      refreshed.field_data,
      { trackingEnabled }
    );
  } catch (e) {
    if (e instanceof PdfRenderError) {
      return jsonError(422, e.reason, e.detail);
    }
    return jsonError(500, 'pdf_failed', e instanceof Error ? e.message : String(e));
  }

  // 2. Archive to R2 (the bytes that go out are the bytes that stay).
  const r2Key = `quotes/${refreshed.id}/${Date.now()}.pdf`;
  try {
    await cfEnv.QUOTE_PDFS.put(r2Key, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: {
        quote_id: refreshed.id,
        template_id: refreshed.template_id,
        recipient: to,
      },
    });
  } catch (e) {
    return jsonError(500, 'r2_put_failed', e instanceof Error ? e.message : String(e));
  }

  // 3. Send via Resend
  const ccList: string[] = [];
  if (ccMe) {
    const ccAddress =
      (cfEnv.QUOTE_CC_EMAIL as string | undefined) ||
      SENDER_ALIAS_CONFIG[alias as SenderAlias].email;
    if (ccAddress && ccAddress !== to) ccList.push(ccAddress);
  }

  let messageId: string;
  try {
    const result = await sendQuoteEmail(apiKey, {
      from_alias: alias as SenderAlias,
      to,
      subject: finalSubject,
      body: finalBody,
      cc: ccList,
      pdfBytes,
      pdfFilename: `${entry.meta.name.replace(/\s+/g, '-').toLowerCase()}-${refreshed.id.slice(0, 8)}.pdf`,
      trackingEnabled,
    });
    messageId = result.messageId;
  } catch (e) {
    // PDF is archived but send failed. Leave quote in draft, log the
    // event so the timeline reflects the attempt.
    await recordEvent(cfEnv.DB, refreshed.id, 'status_changed', {
      attempted_send: true,
      error: e instanceof SendError ? e.reason : 'unknown',
      detail: e instanceof Error ? e.message : String(e),
    });
    if (e instanceof SendError) {
      return jsonError(502, e.reason, e.detail);
    }
    return jsonError(500, 'send_failed', e instanceof Error ? e.message : String(e));
  }

  // 4. Commit state machine: draft → sent
  await markSent(cfEnv.DB, refreshed.id, messageId, r2Key);
  await recordEvent(cfEnv.DB, refreshed.id, 'sent', {
    to,
    from_alias: alias,
    subject: finalSubject,
    cc: ccList,
    tracking_enabled: trackingEnabled,
    resend_message_id: messageId,
    r2_key: r2Key,
  });

  // Also mirror into the existing email_log table, matching the pattern
  // src/pages/api/email/send.ts already uses, so the CRM's company email
  // history shows quote sends when a company_id is set.
  if (refreshed.company_id) {
    try {
      await cfEnv.DB.prepare(
        `INSERT INTO email_log (id, company_id, to_email, subject, body, status)
         VALUES (?, ?, ?, ?, ?, 'sent')`
      )
        .bind(generateId(), refreshed.company_id, to, finalSubject, finalBody)
        .run();
    } catch {
      // email_log mirror is best-effort
    }
  }

  const finalQuote = await getQuote(cfEnv.DB, refreshed.id);
  return new Response(JSON.stringify(finalQuote), {
    headers: { 'Content-Type': 'application/json' },
  });
};
