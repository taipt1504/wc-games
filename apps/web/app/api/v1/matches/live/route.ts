import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public live-score feed (DATA-07). Light payload for frequent client polling.
// A real provider feed would push scores via the admin live-score ingest endpoint;
// this serves whatever LIVE state is in the DB.
export async function GET() {
  const live = await prisma.match.findMany({
    where: { status: 'LIVE' },
    select: { id: true, scoreHome90: true, scoreAway90: true },
  });
  const data = live.map((m) => ({
    id: Number(m.id),
    home: m.scoreHome90 ?? 0,
    away: m.scoreAway90 ?? 0,
    status: 'LIVE',
  }));
  return NextResponse.json({ data });
}
