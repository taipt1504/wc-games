import { NextResponse } from 'next/server';
import { syncOneMatchFromFd, fdClientFromEnv } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/[id]/sync-result — pull this match's score/status from football-data.org
// on demand (via the match's externalId). Does NOT settle (admin confirms via resettle). Writes source=API + audit.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  // Guard: never let a feed sync revert an already-settled match (would clobber the authoritative
  // ADMIN result + leave settled predictions on a SCHEDULED match — the images-8/9 bug). Admin must
  // use Re-settle to correct a settled match.
  const settlement = await prisma.settlement.findUnique({ where: { matchId: BigInt(id) } });
  if (settlement && settlement.status === 'DONE') {
    return NextResponse.json({ error: { code: 'ALREADY_SETTLED' } }, { status: 409 });
  }

  let client;
  try {
    client = fdClientFromEnv();
  } catch {
    return NextResponse.json({ error: { code: 'NO_API_KEY' } }, { status: 503 });
  }

  try {
    const r = await syncOneMatchFromFd(prisma, client, BigInt(id));
    await prisma.auditLog.create({
      data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_RESULT', target: `match:${id}`, metadata: { status: r.status, score: `${r.scoreHome90 ?? '-'}-${r.scoreAway90 ?? '-'}` } },
    });
    return NextResponse.json({ data: r });
  } catch (e) {
    const code = (e as Error).message === 'MATCH_NOT_LINKED' ? 'MATCH_NOT_LINKED' : 'SYNC_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'MATCH_NOT_LINKED' ? 404 : 502 });
  }
}
