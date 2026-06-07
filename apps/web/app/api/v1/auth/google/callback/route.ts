import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findOrCreateOAuthUser } from '@wc/auth';
import { prisma } from '@/lib/db';
import { attachSessionCookies } from '@/lib/session';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'g_oauth_state';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Google OAuth2 callback: verify state + id_token, then find/create the user and start a session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (reason: string) => NextResponse.redirect(`${origin}/?auth_error=${reason}`);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const savedState = jar.get(STATE_COOKIE)?.value;
  if (!code || !state || !savedState || state !== savedState) return fail('google_state');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('google_not_configured');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/v1/auth/google/callback`;

  // Exchange the authorization code for tokens.
  let idToken: string | undefined;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('google');
    idToken = (await tokenRes.json()).id_token;
  } catch {
    return fail('google');
  }
  if (!idToken) return fail('google');

  // Verify the ID token signature + issuer/audience against Google's JWKS.
  let email: string | undefined;
  let emailVerified: boolean | undefined;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    email = payload.email as string | undefined;
    emailVerified = payload.email_verified as boolean | undefined;
  } catch {
    return fail('google');
  }
  if (!email || emailVerified === false) return fail('google_email');

  try {
    const user = await findOrCreateOAuthUser(prisma, { email });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const res = NextResponse.redirect(`${origin}/`);
    await attachSessionCookies(res, prisma, user, { ip, userAgent: req.headers.get('user-agent') });
    res.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 }); // clear single-use state
    return res;
  } catch (e) {
    return fail((e as Error).message === 'BANNED' ? 'banned' : 'google');
  }
}
