import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { listMissions } from '@wc/prediction';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const data = await listMissions(prisma, user.id);
  return NextResponse.json({ data });
}
