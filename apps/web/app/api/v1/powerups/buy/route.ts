import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buyPowerUp } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const Schema = z.object({
  type: z.enum(['DOUBLE_DOWN', 'INSURANCE', 'STREAK_SHIELD']),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    await buyPowerUp(prisma, user.id, parsed.data.type);
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    const code = (e as Error).message;
    if (code === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: { code } }, { status: 422 });
    throw e;
  }
}
