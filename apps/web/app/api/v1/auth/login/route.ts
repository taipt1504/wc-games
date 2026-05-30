import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLogin } from '@wc/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/session';

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  try {
    const user = await verifyLogin(prisma, parsed.data);
    await createSession(user);
    return NextResponse.json({ data: { id: user.id, email: user.email } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'BANNED') return NextResponse.json({ error: { code: 'BANNED' } }, { status: 403 });
    if (msg === 'INVALID_CREDENTIALS') return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    throw e;
  }
}
