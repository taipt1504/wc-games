import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adjustMemberPoints } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const Schema = z.object({ delta: z.coerce.number().int().refine((n) => n !== 0, 'delta must be non-zero') });

// POST /api/v1/lobbies/[id]/members/[uid]/adjust — host grants/deducts a member's lobby points.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id, uid } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });

  try {
    const r = await adjustMemberPoints(prisma, BigInt(id), user.id, BigInt(uid), BigInt(parsed.data.delta));
    return NextResponse.json({ data: { balance: Number(r.balance) } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_HOST') return NextResponse.json({ error: { code: 'NOT_HOST' } }, { status: 403 });
    if (msg === 'NOT_A_MEMBER') return NextResponse.json({ error: { code: 'NOT_A_MEMBER' } }, { status: 404 });
    if (msg === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: { code: 'INSUFFICIENT_BALANCE' } }, { status: 422 });
    throw e;
  }
}
