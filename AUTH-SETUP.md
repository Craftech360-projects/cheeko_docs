# Docs site access control

The site is gated behind Google sign-in at the Vercel edge. Only
`@craftech360.com` and `@altio.me` emails are allowed. Everything —
pages, JS, images — is protected, including the `*.vercel.app` URLs.

## How it works

- `middleware.ts` runs on every request. No valid session cookie →
  redirect to `/api/auth/login`.
- `api/auth/login.ts` → Google OAuth consent (scope `openid email`).
- `api/auth/callback.ts` → verifies the email domain, sets a signed
  HttpOnly session cookie (7-day expiry), redirects back.
- Allowed domains live in `lib/auth.ts` (`ALLOWED_DOMAINS`).

## One-time setup (needs credentials — do this yourself)

### 1. Google OAuth client
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
→ Create Credentials → OAuth client ID → **Web application**.

Authorized redirect URIs:
```
https://docs.cheekoai.in/api/auth/callback
https://cheeko-docs.vercel.app/api/auth/callback
```
Copy the **Client ID** and **Client secret**.

### 2. Vercel environment variables
Project → Settings → Environment Variables (Production + Preview):

| Name                   | Value                                          |
|------------------------|------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | from step 1                                    |
| `GOOGLE_CLIENT_SECRET` | from step 1                                     |
| `SESSION_SECRET`       | random string, e.g. `openssl rand -hex 32`     |

Redeploy after adding them.

## Verify

1. Incognito → visit the site → redirected to Google.
2. Sign in with an allowed email → land on the docs.
3. Sign in with a gmail.com account → 403 "Access denied".
4. Hit a static asset URL directly (e.g. `/img/favicon.ico`) with no
   cookie → still redirected to login.

## Add/remove allowed domains

Edit `ALLOWED_DOMAINS` in `lib/auth.ts`, commit, redeploy.

## Test

```
node --experimental-strip-types test/auth.test.mjs
```
