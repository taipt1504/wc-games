import { NextResponse } from 'next/server';
import { syncTeamsAndSquads, fdClientFromEnv } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/teams/sync-all — sync every team + squad from football-data.org (1 API call).
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  let client;
  try {
    client = fdClientFromEnv();
  } catch {
    return NextResponse.json({ error: { code: 'NO_API_KEY' } }, { status: 503 });
  }

  try {
    const r = await syncTeamsAndSquads(prisma, client);
    await prisma.auditLog.create({
      data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_SQUADS_ALL', target: 'teams', metadata: { teams: r.teams, players: r.players, unmatched: r.unmatched } },
    });
    return NextResponse.json({ data: r });
  } catch (e) {
    return NextResponse.json({ error: { code: 'SYNC_FAILED', message: (e as Error).message } }, { status: 502 });
  }
}
