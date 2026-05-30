import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — user management list (admin only). UI AdminUser shape.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const wallets = await prisma.wallet.findMany({
    where: { contextType: 'GLOBAL', userId: { in: users.map((u) => u.id) } },
  });
  const balOf = (id: bigint) => Number(wallets.find((w) => w.userId === id)?.balance ?? 0);

  const data = users.map((u) => ({
    id: Number(u.id),
    name: u.username || u.email.split('@')[0],
    email: u.email,
    pts: balOf(u.id),
    ip: '—',
    status: u.status.toLowerCase(),
    flags: 0,
    joined: u.createdAt.toISOString().slice(0, 10),
  }));
  return NextResponse.json({ data });
}
