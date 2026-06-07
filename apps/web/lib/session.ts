import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@wc/db';
import { createAuthSession, revokeSession, hashToken } from '@wc/auth';

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');
const ACCESS_COOKIE = 'wc_session';
const REFRESH_COOKIE = 'wc_refresh';
const ACCESS_TTL = '1h';
const ACCESS_MAX_AGE = 60 * 60; // 1h
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30d

export interface SessionUser {
  id: bigint;
  email: string;
  role: string;
}

function cookieOpts(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge };
}

async function signAccess(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id.toString())
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

/** Mint a fresh access cookie (short-lived JWT). Used on login and after a refresh rotation. */
export async function setAccessCookie(user: SessionUser): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, await signAccess(user), cookieOpts(ACCESS_MAX_AGE));
}

/** Set the refresh cookie to a raw token (its sha256 hash is persisted in AuthSession separately). */
export async function setRefreshCookie(rawToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, rawToken, cookieOpts(REFRESH_MAX_AGE));
}

/** Create a session (login/register): write the AuthSession row + set access & refresh cookies on the jar. */
export async function createSession(
  prisma: PrismaClient,
  user: SessionUser,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  const rawRefresh = randomBytes(32).toString('hex');
  await createAuthSession(prisma, user.id, hashToken(rawRefresh), meta.ip, meta.userAgent);
  await setAccessCookie(user);
  await setRefreshCookie(rawRefresh);
}

/**
 * Like createSession, but writes the cookies onto a NextResponse — required for redirect responses
 * (the cookies() jar does not attach Set-Cookie to a NextResponse.redirect; see Next.js OAuth docs).
 */
export async function attachSessionCookies(
  res: NextResponse,
  prisma: PrismaClient,
  user: SessionUser,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  const rawRefresh = randomBytes(32).toString('hex');
  await createAuthSession(prisma, user.id, hashToken(rawRefresh), meta.ip, meta.userAgent);
  res.cookies.set(ACCESS_COOKIE, await signAccess(user), cookieOpts(ACCESS_MAX_AGE));
  res.cookies.set(REFRESH_COOKIE, rawRefresh, cookieOpts(REFRESH_MAX_AGE));
}

/** Read + verify the access JWT. Returns null when absent/invalid/expired. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: BigInt(payload.sub as string), email: payload.email as string, role: payload.role as string };
  } catch {
    return null;
  }
}

/** Read the raw refresh token from the cookie (consumed by /api/v1/auth/refresh). */
export async function getRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

/** Delete both auth cookies without a DB write (used when the refresh token is already invalid). */
export async function clearCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Logout: revoke the server-side session for the current refresh token, then clear both cookies. */
export async function clearSession(prisma: PrismaClient): Promise<void> {
  const raw = await getRefreshToken();
  if (raw) {
    try { await revokeSession(prisma, hashToken(raw)); } catch { /* clear cookies regardless */ }
  }
  await clearCookies();
}

/** Returns the session user only if they hold an operator role, else null (PRD §16 RBAC). */
export async function requireAdmin(): Promise<SessionUser | null> {
  const u = await getSessionUser();
  if (!u || !['ADMIN', 'SUPER', 'MOD'].includes(u.role)) return null;
  return u;
}
