import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');
const COOKIE = 'wc_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30d

export interface SessionUser {
  id: bigint;
  email: string;
  role: string;
}

/** Sign a JWT and set it as an httpOnly cookie (PRD §16). */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id.toString())
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

/** Read + verify the session cookie. Returns null when absent/invalid. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: BigInt(payload.sub as string), email: payload.email as string, role: payload.role as string };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Returns the session user only if they hold an operator role, else null (PRD §16 RBAC). */
export async function requireAdmin(): Promise<SessionUser | null> {
  const u = await getSessionUser();
  if (!u || !['ADMIN', 'SUPER', 'MOD'].includes(u.role)) return null;
  return u;
}
