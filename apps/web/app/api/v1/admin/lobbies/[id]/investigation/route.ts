import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — lobby risk investigation detail (admin only). ADMIN-02.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const [lobby, memberships, flags, pointFlow] = await Promise.all([
    prisma.lobby.findUnique({ where: { id: lobbyId } }),
    prisma.lobbyMembership.findMany({
      where: { lobbyId },
      include: { user: { select: { id: true, email: true, username: true } } },
    }),
    prisma.riskFlag.findMany({
      where: { targetType: 'LOBBY', targetId: lobbyId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pointLedger.findMany({
      where: { contextType: 'LOBBY', contextId: lobbyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  if (!lobby) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  // Sum borrowed per member
  const totalBorrowed = memberships.reduce((acc, m) => acc + Number(m.borrowed), 0);

  // Recent BORROW / SETTLE entries
  const recentFlow = pointFlow
    .filter((e) => e.type === 'BORROW' || e.type === 'SETTLE')
    .map((e) => ({
      userId: Number(e.userId),
      type: e.type,
      amount: Number(e.amount),
      createdAt: e.createdAt.toISOString(),
    }));

  return NextResponse.json({
    data: {
      lobby: {
        id: Number(lobby.id),
        name: lobby.name ?? `lobby ${id}`,
        status: lobby.status,
        ownerId: Number(lobby.ownerId),
      },
      flags: flags.map((f) => ({
        id: Number(f.id),
        rule: f.rule,
        severity: f.severity,
        status: f.status,
        reasons: f.rule.split('; '),
        createdAt: f.createdAt.toISOString(),
      })),
      members: memberships.map((m) => ({
        id: Number(m.id),
        userId: Number(m.user.id),
        email: m.user.email,
        username: m.user.username ?? m.user.email.split('@')[0],
        role: m.role,
        borrowed: Number(m.borrowed),
        defaultPoints: Number(m.defaultPoints),
      })),
      pointFlow: {
        totalBorrowed,
        recentEntries: recentFlow,
      },
    },
  });
}
