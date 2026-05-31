import { NextResponse } from 'next/server';
import { kickMember } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const { userId } = await req.json();
  try {
    await kickMember(prisma, BigInt(id), user.id, BigInt(userId));
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_OWNER') return NextResponse.json({ error: { code: 'NOT_OWNER' } }, { status: 403 });
    if (msg === 'CANNOT_KICK_OWNER') return NextResponse.json({ error: { code: 'CANNOT_KICK_OWNER' } }, { status: 409 });
    if (msg === 'NOT_A_MEMBER') return NextResponse.json({ error: { code: 'NOT_A_MEMBER' } }, { status: 404 });
    throw e;
  }
}
