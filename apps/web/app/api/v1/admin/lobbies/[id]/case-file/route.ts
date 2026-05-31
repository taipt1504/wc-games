import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — create a case-file for a lobby (admin only). ADMIN-03.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  // Gather evidence bundle (members + flags + point-flow)
  const [memberships, flags, pointFlow] = await Promise.all([
    prisma.lobbyMembership.findMany({
      where: { lobbyId },
      include: { user: { select: { id: true, email: true, username: true } } },
    }),
    prisma.riskFlag.findMany({
      where: { targetType: 'LOBBY', targetId: lobbyId, status: 'OPEN' },
    }),
    prisma.pointLedger.findMany({
      where: { contextType: 'LOBBY', contextId: lobbyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const evidence = {
    lobbyId: id,
    generatedAt: new Date().toISOString(),
    flags: flags.map((f) => ({
      id: Number(f.id),
      rule: f.rule,
      severity: f.severity,
      status: f.status,
    })),
    members: memberships.map((m) => ({
      userId: Number(m.user.id),
      email: m.user.email,
      username: m.user.username ?? m.user.email.split('@')[0],
      role: m.role,
      borrowed: Number(m.borrowed),
    })),
    pointFlow: pointFlow.map((e) => ({
      userId: Number(e.userId),
      type: e.type,
      amount: Number(e.amount),
      createdAt: e.createdAt.toISOString(),
    })),
  };

  const [caseFile] = await prisma.$transaction([
    prisma.caseFile.create({
      data: {
        subject: `lobby:${id}`,
        evidenceRef: JSON.stringify(evidence),
        status: 'OPEN',
      },
    }),
    prisma.moderationAction.create({
      data: {
        adminId: admin.id,
        targetType: 'LOBBY',
        targetId: lobbyId,
        action: 'CASE_FILE',
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'CASE_FILE',
        target: `lobby:${id}`,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      caseFile: { id: Number(caseFile.id), subject: caseFile.subject, status: caseFile.status },
      evidence,
    },
  });
}
