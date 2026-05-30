import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerUser } from '@wc/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/session';

const Schema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  try {
    const user = await registerUser(prisma, parsed.data);
    await createSession(user);
    return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'EMAIL_TAKEN') {
      return NextResponse.json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } }, { status: 409 });
    }
    throw e;
  }
}
