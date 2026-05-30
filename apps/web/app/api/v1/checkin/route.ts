import { NextResponse } from 'next/server';
import { dailyCheckin } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  try {
    const r = await dailyCheckin(prisma, user.id);
    return NextResponse.json({ data: { balance: r.balance, reward: r.reward, streak: r.streak } });
  } catch (e) {
    if ((e as Error).message === 'ALREADY_CHECKED_IN') {
      return NextResponse.json({ error: { code: 'ALREADY_CHECKED_IN', message: 'Already checked in today' } }, { status: 409 });
    }
    throw e;
  }
}
