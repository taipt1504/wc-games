import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { clearSession } from '@/lib/session';

export async function POST() {
  await clearSession(prisma);
  return NextResponse.json({ data: { ok: true } });
}
