import {
  ALLOWED_DOMAINS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  decodeIdTokenEmail,
  emailAllowed,
} from '../../lib/auth';

export const config = { runtime: 'edge' };

function deniedPage(email: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>Access denied</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1c1e21}
code{background:#f0f0f0;padding:.1em .4em;border-radius:4px}a{color:#2e8555}</style>
<h1>Access denied</h1>
<p><code>${email || 'This account'}</code> is not permitted.</p>
<p>Sign in with a <strong>${ALLOWED_DOMAINS.join('</strong> or <strong>')}</strong> email.</p>
<p><a href="/api/auth/login">Try a different account</a></p>`;
  return new Response(html, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export default async function handler(request: Request): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const secret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !secret) {
    return new Response('Auth misconfigured: missing Google/session env vars.', { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing authorization code.', { status: 400 });
  const rt = url.searchParams.get('state') || '/';
  const returnTo = rt.startsWith('/') && !rt.startsWith('//') ? rt : '/';

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return new Response('Token exchange failed.', { status: 502 });

  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  const claims = id_token ? decodeIdTokenEmail(id_token) : null;
  if (!claims || !claims.verified) return deniedPage(claims?.email || '');
  if (!emailAllowed(claims.email)) return deniedPage(claims.email);

  const session = await createSession(claims.email, secret);
  const cookie = `${SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
  return new Response(null, {
    status: 302,
    headers: { location: returnTo, 'set-cookie': cookie },
  });
}
