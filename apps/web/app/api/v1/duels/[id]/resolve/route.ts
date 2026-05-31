import { NextResponse } from 'next/server';
import { resolveDuel } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;

  try {
    const result = await resolveDuel(prisma, BigInt(id));
    return NextResponse.json({ data: result });
  } catch (e) {
    if ((e as Error).message === 'NOT_ACTIVE') {
      return NextResponse.json({ error: { code: 'NOT_ACTIVE' } }, { status: 409 });
    }
    throw e;
  }
}
