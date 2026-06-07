import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { rotateRefresh, hashToken } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getRefreshToken, setAccessCookie, setRefreshCookie, clearCookies } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Rotate the refresh token and mint a fresh access JWT. Powers transparent re-auth after F5/expiry. */
export async function POST(req: Request) {
  const raw = await getRefreshToken();
  if (!raw) return NextResponse.json({ error: { code: 'NO_REFRESH' } }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent');
  const newRaw = randomBytes(32).toString('hex');

  try {
    const user = await rotateRefresh(prisma, hashToken(raw), hashToken(newRaw), ip, userAgent);
    await setAccessCookie(user);
    await setRefreshCookie(newRaw);
    return NextResponse.json({ data: { id: user.id, email: user.email } });
  } catch (e) {
    await clearCookies();
    const msg = (e as Error).message;
    if (msg === 'BANNED') return NextResponse.json({ error: { code: 'BANNED' } }, { status: 403 });
    const code = msg === 'REFRESH_REUSE' ? 'REFRESH_REUSE' : 'INVALID_REFRESH';
    return NextResponse.json({ error: { code } }, { status: 401 });
  }
}
