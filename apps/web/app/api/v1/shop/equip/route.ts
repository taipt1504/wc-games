import { NextRequest, NextResponse } from 'next/server';
import { equipCosmetic } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { itemId } = await req.json() as { itemId: string | number };

  try {
    const result = await equipCosmetic(prisma, user.id, BigInt(itemId));
    return NextResponse.json({ data: result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_OWNED') return NextResponse.json({ error: { code: msg } }, { status: 409 });
    throw e;
  }
}
