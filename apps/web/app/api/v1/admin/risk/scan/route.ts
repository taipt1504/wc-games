import { NextResponse } from 'next/server';
import { scanLobbyRisk } from '@wc/risk';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — run the anti-abuse risk engine on demand (admin only).
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const result = await scanLobbyRisk(prisma);
  return NextResponse.json({ data: result });
}
