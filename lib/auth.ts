// Shared auth helpers for Vercel Edge Middleware + OAuth functions.
// Runs in the Edge runtime — only Web Crypto, no Node APIs.

export const ALLOWED_DOMAINS = ['craftech360.com', 'altio.me'];
export const SESSION_COOKIE = '__docs_session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 1 day

const enc = new TextEncoder();

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlEncode(sig);
}

// Constant-time-ish compare (lengths are fixed base64url of SHA-256).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function emailAllowed(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export async function createSession(email: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = b64urlEncode(enc.encode(JSON.stringify({ email, exp })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(
  cookie: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf('.');
  if (dot < 0) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!safeEqual(sig, await hmac(secret, payload))) return null;
  try {
    const { email, exp } = JSON.parse(b64urlDecodeToString(payload));
    if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof email !== 'string' || !emailAllowed(email)) return null;
    return email;
  } catch {
    return null;
  }
}

// Google id_token comes straight from Google's token endpoint over TLS
// (server-to-server), so we trust the payload without JWKS verification.
// ponytail: skip signature check — token fetched directly from Google, not via browser.
export function decodeIdTokenEmail(idToken: string): { email: string; verified: boolean } | null {
  try {
    const [, payload] = idToken.split('.');
    const claims = JSON.parse(b64urlDecodeToString(payload));
    return { email: String(claims.email || ''), verified: claims.email_verified === true };
  } catch {
    return null;
  }
}
