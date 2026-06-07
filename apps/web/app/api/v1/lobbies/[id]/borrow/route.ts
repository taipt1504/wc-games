import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestBorrow } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const Schema = z.object({ amount: z.coerce.number().int().positive().max(1_000_000) });

// POST /api/v1/lobbies/[id]/borrow — a member requests to borrow points from the host pool.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });

  try {
    const r = await requestBorrow(prisma, BigInt(id), user.id, BigInt(parsed.data.amount));
    return NextResponse.json({ data: { id: Number(r.id), amount: Number(r.amount), status: r.status } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'INVALID_AMOUNT') return NextResponse.json({ error: { code: 'INVALID_AMOUNT' } }, { status: 422 });
    // requestBorrow throws (findUniqueOrThrow) when the caller is not a member.
    return NextResponse.json({ error: { code: 'NOT_A_MEMBER' } }, { status: 403 });
  }
}
