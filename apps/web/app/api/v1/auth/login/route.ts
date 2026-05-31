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
    // Capture login IP/UA in the immutable audit log (PRD §09 ADMIN-06 / §16).
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    await prisma.auditLog.create({
      data: { actorType: 'USER', actorId: user.id, action: 'LOGIN', target: user.email, ip, userAgent: req.headers.get('user-agent') },
    });
    return NextResponse.json({ data: { id: user.id, email: user.email } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'BANNED') return NextResponse.json({ error: { code: 'BANNED' } }, { status: 403 });
    if (msg === 'INVALID_CREDENTIALS') return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    throw e;
  }
}
