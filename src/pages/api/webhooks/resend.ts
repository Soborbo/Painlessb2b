import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import {
  getQuoteByMessageId,
  markOpened,
  markClicked,
  recordEvent,
} from '../../../quotes/db';
import { verifyResendSignature } from '../../../quotes/tracking';

// Public route (allow-listed in middleware). Verifies the Svix-compatible
// signature header, then routes the event into quote_events and bumps the
// quote status when the event implies a state-machine transition.
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = await getCfEnv();
  const secret = cfEnv.RESEND_WEBHOOK_SECRET as string | undefined;
  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'webhook_secret_not_configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const svixId = request.headers.get('svix-id') || '';
  const svixTimestamp = request.headers.get('svix-timestamp') || '';
  const svixSignature = request.headers.get('svix-signature') || '';
  const rawBody = await request.text();

  const ok = await verifyResendSignature({
    secret,
    svixId,
    svixTimestamp,
    svixSignatureHeader: svixSignature,
    rawBody,
  });
  if (!ok) {
    return new Response(JSON.stringify({ error: 'invalid_signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const type = String(payload?.type || '');
  const data = payload?.data || {};
  const emailId = data?.email_id;
  if (!emailId || typeof emailId !== 'string') {
    // No email_id — accept-and-drop. Resend will retry on non-2xx; we don't
    // want retries for malformed payloads.
    return new Response(JSON.stringify({ ok: true, dropped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const quote = await getQuoteByMessageId(cfEnv.DB, emailId);
  if (!quote) {
    // We didn't send this email, or it predates the quote tool.
    return new Response(JSON.stringify({ ok: true, unknown: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventPayload: Record<string, unknown> = {
    resend_event: type,
    received_at: payload?.created_at ?? null,
  };
  // Some Resend events include click URL / bounce reason / etc.
  if (data?.click?.link) eventPayload.click_url = data.click.link;
  if (data?.bounce) eventPayload.bounce = data.bounce;

  switch (type) {
    case 'email.opened':
      await markOpened(cfEnv.DB, quote.id);
      await recordEvent(cfEnv.DB, quote.id, 'opened', eventPayload);
      break;
    case 'email.clicked':
      await markClicked(cfEnv.DB, quote.id);
      await recordEvent(cfEnv.DB, quote.id, 'clicked', eventPayload);
      break;
    case 'email.bounced':
      await recordEvent(cfEnv.DB, quote.id, 'bounced', eventPayload);
      break;
    case 'email.complained':
      await recordEvent(cfEnv.DB, quote.id, 'complained', eventPayload);
      break;
    case 'email.delivered':
    case 'email.delivery_delayed':
    case 'email.failed':
    case 'email.sent':
    case 'email.suppressed':
      // Logged but no status transition. They go into the timeline via a
      // status_changed event so M7 has a record.
      await recordEvent(cfEnv.DB, quote.id, 'status_changed', {
        from: quote.status,
        to: quote.status,
        passthrough: type,
        ...eventPayload,
      });
      break;
    default:
      // Unknown event type — still log it so the operator can investigate.
      await recordEvent(cfEnv.DB, quote.id, 'status_changed', {
        from: quote.status,
        to: quote.status,
        unknown_event: type,
        ...eventPayload,
      });
      break;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
