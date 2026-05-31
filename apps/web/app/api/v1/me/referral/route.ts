import { NextResponse } from 'next/server';
import { referralStats } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const data = await referralStats(prisma, user.id);
  return NextResponse.json({ data });
}
