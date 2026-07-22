export const config = { runtime: 'edge' };

export default function handler(request: Request): Response {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response('Auth misconfigured: GOOGLE_CLIENT_ID missing.', { status: 500 });

  const url = new URL(request.url);
  // Only allow same-origin relative return paths (block open-redirect).
  const rt = url.searchParams.get('returnTo') || '/';
  const returnTo = rt.startsWith('/') && !rt.startsWith('//') ? rt : '/';

  const redirectUri = `${url.origin}/api/auth/callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email');
  auth.searchParams.set('access_type', 'online');
  auth.searchParams.set('prompt', 'select_account');
  // ponytail: state carries only the same-origin return path — no CSRF-login
  // storage for a read-only internal docs site. Add signed nonce if that changes.
  auth.searchParams.set('state', returnTo);
  return Response.redirect(auth.toString(), 302);
}
