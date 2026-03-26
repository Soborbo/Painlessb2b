import { COOKIE_NAME, COOKIE_MAX_AGE } from './constants';

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(signature);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function createSessionCookie(secret: string): Promise<string> {
  const expires = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `admin:${expires}`;
  const sig = await hmacSign(payload, secret);
  const token = btoa(`${payload}:${sig}`);
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export async function verifySession(cookieHeader: string | null, secret: string): Promise<boolean> {
  if (!cookieHeader) return false;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!sessionCookie) return false;

  const token = sessionCookie.split('=').slice(1).join('=');
  let decoded: string;
  try {
    decoded = atob(token);
  } catch {
    return false;
  }

  const parts = decoded.split(':');
  if (parts.length < 3) return false;

  const sig = parts.pop()!;
  const payload = parts.join(':');
  const [, expiresStr] = payload.split(':');

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Date.now() > expires) return false;

  return hmacVerify(payload, sig, secret);
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
