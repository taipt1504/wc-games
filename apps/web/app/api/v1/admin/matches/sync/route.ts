import { NextResponse } from 'next/server';
import { syncMatchesFromFeed } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/sync — bulk-sync all fixtures from the worldcup26 feed.
// Match-only upsert (+ house odds when missing); leaves teams/players/venues untouched and
// never reverts an admin-confirmed result (source=ADMIN matches are skipped). Records an audit row.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  try {
    const r = await syncMatchesFromFeed(prisma);
    await prisma.auditLog.create({
      data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_MATCHES', target: 'tournament', metadata: r },
    });
    return NextResponse.json({ data: r });
  } catch (e) {
    return NextResponse.json({ error: { code: 'SYNC_FAILED', message: (e as Error).message } }, { status: 502 });
  }
}
