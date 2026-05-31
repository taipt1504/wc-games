import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@wc/auth';
import { prisma } from '@/lib/db';

// NOTE: Email delivery is deferred infra (no SMTP configured).
// The reset token is returned directly in this response (dev/no-email mode).
// In production with SMTP, remove 'resetToken' from the response and send it via email instead.

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  const result = await requestPasswordReset(prisma, parsed.data.email);
  // Always 200; token presence reveals whether the email exists — acceptable for dev no-email mode.
  return NextResponse.json({ data: { ok: true, resetToken: result.token ?? null } });
}
