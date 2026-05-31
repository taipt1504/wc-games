import { NextResponse } from 'next/server';
import { z } from 'zod';
import { settleMicro } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({ won: z.boolean() });

// POST — admin settles an in-play micro-prediction (DEPTH-06).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  const { id } = await params;

  try {
    const result = await settleMicro(prisma, BigInt(id), parsed.data.won);
    return NextResponse.json({ data: { status: result.status, payout: String(result.payout) } });
  } catch (e) {
    const code = (e as Error).message;
    if (code === 'ALREADY_SETTLED') return NextResponse.json({ error: { code } }, { status: 409 });
    throw e;
  }
}
