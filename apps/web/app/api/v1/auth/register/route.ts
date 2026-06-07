import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerUser, redeemReferral } from '@wc/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/session';

const Schema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(6).max(128),
  ref: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  const { email, username, password, ref } = parsed.data;
  try {
    const user = await registerUser(prisma, { email, username, password });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    await createSession(prisma, user, { ip, userAgent: req.headers.get('user-agent') });
    if (ref) {
      try { await redeemReferral(prisma, user.id, ref); } catch { /* never break signup */ }
    }
    return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'EMAIL_TAKEN') {
      return NextResponse.json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } }, { status: 409 });
    }
    throw e;
  }
}
