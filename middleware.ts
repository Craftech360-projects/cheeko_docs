import { next } from '@vercel/edge';
import { SESSION_COOKIE, verifySession } from './lib/auth';

// Protect everything except the auth endpoints and Google's callback.
export const config = {
  matcher: ['/((?!api/auth/).*)'],
};

export default async function middleware(request: Request): Promise<Response> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new Response('Auth misconfigured: SESSION_SECRET missing.', { status: 500 });
  }

  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const email = await verifySession(match?.[1], secret);
  if (email) return next();

  const url = new URL(request.url);
  const returnTo = url.pathname + url.search;
  const login = new URL('/api/auth/login', url.origin);
  login.searchParams.set('returnTo', returnTo);
  return Response.redirect(login.toString(), 302);
}
