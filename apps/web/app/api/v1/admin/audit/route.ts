import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Severity colour per action for the UI badge.
const SEV: Record<string, string> = {
  BAN_USER: 'danger', REVOKE_POINTS: 'danger',
  LOGIN: 'muted', REGISTER: 'muted',
  PUBLISH_NEWS: 'green', REJECT_NEWS: 'gold', SETTLE: 'sky',
};

// GET — immutable audit log (admin only). PRD §09 ADMIN-06 / §16.
// Optional ?action= / ?actorId= filters; newest first.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? undefined;
  const actorId = url.searchParams.get('actorId');
  const rows = await prisma.auditLog.findMany({
    where: { ...(action ? { action } : {}), ...(actorId ? { actorId: BigInt(actorId) } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const data = rows.map((a) => {
    const meta = a.metadata as { reason?: string } | null;
    return {
      action: a.action,
      desc: `${a.target ?? a.action}${a.ip ? ' · ' + a.ip : ''}`,
      reason: meta?.reason ?? '—',
      when: a.createdAt.toISOString().slice(11, 16),
      sev: SEV[a.action] ?? 'sky',
    };
  });
  return NextResponse.json({ data });
}
