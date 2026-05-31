import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { claimMission } from '@wc/prediction';

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { code } = await params;
  try {
    const { reward, balance } = await claimMission(prisma, user.id, code);
    return NextResponse.json({ data: { reward, balance: Number(balance) } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_COMPLETE') {
      return NextResponse.json({ error: { code: 'NOT_COMPLETE', message: 'Mission not yet complete' } }, { status: 409 });
    }
    if (msg === 'ALREADY_CLAIMED') {
      return NextResponse.json({ error: { code: 'ALREADY_CLAIMED', message: 'Already claimed today' } }, { status: 409 });
    }
    throw e;
  }
}
