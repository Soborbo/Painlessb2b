// URL-safe base64 (RFC 4648 §5) — no padding, '+'→'-', '/'→'_'.
function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return atob(padded + (pad ? '='.repeat(4 - pad) : ''));
}

export function encodeTargetUrl(url: string): string {
  return base64UrlEncode(url);
}
export function decodeTargetUrl(encoded: string): string {
  return base64UrlDecode(encoded);
}

// Rewrites every <a href="…"> in the HTML to route through the click
// tracker. mailto:/tel:/anchor links and links already pointing at the
// tracker are left untouched. The token is the quote's tracking_token.
//
// HTML attribute parsing here is intentionally simple: it matches
// `href="value"` or `href='value'`. Our template HTML is generated
// server-side from a single trusted template, so we control the markup.
// We do not run this on user-supplied HTML.
export function rewriteLinks(
  html: string,
  token: string,
  baseUrl: string
): string {
  return html.replace(
    /(<a\b[^>]*\bhref=)(["'])([^"']+)\2/gi,
    (full, prefix, quote, url) => {
      if (
        !url ||
        url.startsWith('#') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('data:') ||
        url.startsWith(`${baseUrl}/r/`)
      ) {
        return full;
      }
      const target = `${baseUrl}/r/${encodeURIComponent(token)}?u=${encodeURIComponent(
        encodeTargetUrl(url)
      )}`;
      return `${prefix}${quote}${target}${quote}`;
    }
  );
}

// ---------------------------------------------------------------------------
// Resend webhook signature verification (Svix-compatible).
// Headers:
//   svix-id: msg_xxxxxxxxxxxx
//   svix-timestamp: <unix seconds>
//   svix-signature: "v1,<base64 hmac>" (space-separated if multiple keys)
// Signed payload string: `${svix-id}.${svix-timestamp}.${raw body}`
// Secret format: "whsec_<base64-of-secret-bytes>"
// ---------------------------------------------------------------------------

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

const FIVE_MINUTES = 5 * 60 * 1000;

export async function verifyResendSignature(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignatureHeader: string;
  rawBody: string;
  toleranceMs?: number;
}): Promise<boolean> {
  if (!opts.secret || !opts.svixId || !opts.svixTimestamp || !opts.svixSignatureHeader) {
    return false;
  }

  const tsSeconds = Number(opts.svixTimestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const tolerance = opts.toleranceMs ?? FIVE_MINUTES;
  const drift = Math.abs(Date.now() - tsSeconds * 1000);
  if (drift > tolerance) return false;

  const secretBody = opts.secret.startsWith('whsec_')
    ? opts.secret.slice('whsec_'.length)
    : opts.secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretBody), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const toSign = `${opts.svixId}.${opts.svixTimestamp}.${opts.rawBody}`;
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(toSign) as BufferSource
  );
  const expected = new Uint8Array(sigBuf);

  for (const part of opts.svixSignatureHeader.split(' ')) {
    const [version, b64] = part.split(',');
    if (version !== 'v1' || !b64) continue;
    let provided: Uint8Array;
    try {
      provided = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      continue;
    }
    if (timingSafeEqualBytes(expected, provided)) return true;
  }
  return false;
}
