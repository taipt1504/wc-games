import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { getBracket, saveBracket } from '@wc/prediction';

export const dynamic = 'force-dynamic';

const PutSchema = z.object({
  picks: z.object({
    CHAMPION: z.number().int().optional(),
    FINALISTS: z.array(z.number().int()).max(2).optional(),
    SEMIS: z.array(z.number().int()).max(4).optional(),
  }),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const data = await getBracket(prisma, user.id);
  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_PICKS', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    const data = await saveBracket(prisma, user.id, parsed.data.picks);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'BRACKET_LOCKED') return NextResponse.json({ error: { code: 'BRACKET_LOCKED' } }, { status: 409 });
    if (msg === 'INVALID_PICKS') return NextResponse.json({ error: { code: 'INVALID_PICKS' } }, { status: 422 });
    throw e;
  }
}
