import { NextRequest, NextResponse } from 'next/server';
import { buyCosmetic } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { code } = await req.json() as { code: string };

  try {
    const result = await buyCosmetic(prisma, user.id, code);
    return NextResponse.json({ data: { ok: true, balance: result.balance } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'ITEM_NOT_FOUND')       return NextResponse.json({ error: { code: msg } }, { status: 404 });
    if (msg === 'ALREADY_OWNED')        return NextResponse.json({ error: { code: msg } }, { status: 409 });
    if (msg === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: { code: msg } }, { status: 422 });
    throw e;
  }
}
