import { NextResponse } from 'next/server';
import { listPowerUps } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const inventory = await listPowerUps(prisma, user.id);
  return NextResponse.json({ data: inventory });
}
