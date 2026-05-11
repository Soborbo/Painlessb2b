import { Resend } from 'resend';
import type { Quote, SenderAlias } from './types';

export interface SendInput {
  from_alias: SenderAlias;
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  pdfBytes: Uint8Array;
  pdfFilename: string;
  trackingEnabled: boolean;
}

export interface SendResult {
  messageId: string;
}

export class SendError extends Error {
  constructor(public reason: string, public detail?: string) {
    super(reason);
  }
}

// Verified sender aliases on painlessremovals.com. The label is what
// recipients see in their inbox ("Jay <jay@painlessremovals.com>").
export const SENDER_ALIAS_CONFIG: Record<SenderAlias, { email: string; name: string }> = {
  jay: { email: 'jay@painlessremovals.com', name: 'Jay' },
  richard: { email: 'richard@painlessremovals.com', name: 'Richard' },
  quotes: { email: 'quotes@painlessremovals.com', name: 'Painless Removals' },
  hello: { email: 'hello@painlessremovals.com', name: 'Painless Removals' },
};

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid the spread-on-large-array stack overflow.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyToHtml(plain: string): string {
  // Plain → HTML with paragraph + line-break preservation. Used only when
  // tracking is on, so Resend can inject the open-tracking pixel.
  const paragraphs = plain.split(/\n{2,}/).map(
    (para) => `<p>${escapeHtml(para).replace(/\n/g, '<br />')}</p>`
  );
  return `<!DOCTYPE html><html><body>${paragraphs.join('')}</body></html>`;
}

export async function sendQuoteEmail(
  apiKey: string,
  input: SendInput
): Promise<SendResult> {
  const sender = SENDER_ALIAS_CONFIG[input.from_alias];
  if (!sender) throw new SendError('invalid_sender_alias');

  const resend = new Resend(apiKey);

  const payload: Parameters<typeof resend.emails.send>[0] = {
    from: `${sender.name} <${sender.email}>`,
    to: [input.to],
    subject: input.subject,
    text: input.body,
    attachments: [
      {
        filename: input.pdfFilename,
        content: bytesToBase64(input.pdfBytes),
        contentType: 'application/pdf',
      },
    ],
  };

  if (input.cc && input.cc.length > 0) payload.cc = input.cc;

  // Resend's open-tracking pixel is only injected for html bodies; sending
  // text-only effectively opts out of opens (clicks via /r/<token> still
  // work because they're server-side redirects).
  if (input.trackingEnabled) {
    payload.html = bodyToHtml(input.body);
  }

  let result;
  try {
    result = await resend.emails.send(payload);
  } catch (e) {
    throw new SendError('resend_threw', e instanceof Error ? e.message : String(e));
  }

  if (result.error) {
    throw new SendError(
      'resend_rejected',
      typeof result.error === 'string'
        ? result.error
        : JSON.stringify(result.error)
    );
  }
  const id = result.data?.id;
  if (!id) throw new SendError('resend_no_id', 'Response missing id');

  return { messageId: id };
}

export function buildSubjectAndBody(
  quote: Quote,
  templateDefaultSubject: string,
  templateDefaultBody: string
): { subject: string; body: string } {
  const subject = quote.subject || templateDefaultSubject;
  const body = quote.message_body || templateDefaultBody;

  const senderName = quote.sender_alias
    ? SENDER_ALIAS_CONFIG[quote.sender_alias].name
    : 'Painless Removals';
  const recipientFirstName = (quote.recipient_name || '').split(/\s+/)[0] || 'there';

  const substitute = (text: string): string =>
    text
      .replace(/\{\{recipient_first_name\}\}/g, recipientFirstName)
      .replace(/\{\{recipient_name\}\}/g, quote.recipient_name || recipientFirstName)
      .replace(/\{\{sender_name\}\}/g, senderName)
      .replace(/\{\{(\w+)\}\}/g, (_m, key) => quote.field_data[key] ?? '');

  return { subject: substitute(subject), body: substitute(body) };
}
