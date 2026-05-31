import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changePassword } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
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
    await changePassword(prisma, user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'INVALID_CREDENTIALS') return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 403 });
    if (msg === 'WEAK_PASSWORD') return NextResponse.json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } }, { status: 422 });
    throw e;
  }
}
