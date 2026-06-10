import { NextResponse } from 'next/server';
import { syncOneTeamSquadFromFd, fdClientFromEnv } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/teams/[id]/sync-fd — sync this team's squad from football-data.org (real roster).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  let client;
  try {
    client = fdClientFromEnv();
  } catch {
    return NextResponse.json({ error: { code: 'NO_API_KEY' } }, { status: 503 });
  }

  try {
    const r = await syncOneTeamSquadFromFd(prisma, client, BigInt(id));
    await prisma.auditLog.create({
      data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_SQUAD_FD', target: `team:${id}`, metadata: { players: r.players } },
    });
    return NextResponse.json({ data: r });
  } catch (e) {
    const msg = (e as Error).message;
    const code = msg === 'TEAM_NOT_FOUND' || msg === 'TEAM_NOT_IN_FD' ? msg : 'SYNC_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'SYNC_FAILED' ? 502 : 404 });
  }
}
