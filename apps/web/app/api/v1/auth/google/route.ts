import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'g_oauth_state';

/** Start the Google OAuth2 Authorization-Code flow: set a CSRF state cookie + redirect to Google. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?auth_error=google_not_configured`);
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/v1/auth/google/callback`;

  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  // Set the state cookie on the redirect response (jar does not attach to a redirect).
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  });
  return res;
}
