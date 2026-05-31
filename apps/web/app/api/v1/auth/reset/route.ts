import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPassword } from '@wc/auth';
import { prisma } from '@/lib/db';

const Schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    await resetPassword(prisma, parsed.data.token, parsed.data.newPassword);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'INVALID_TOKEN') return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 400 });
    if (msg === 'WEAK_PASSWORD') return NextResponse.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } }, { status: 422 });
    throw e;
  }
}
