import { NextResponse } from 'next/server';
import { groupStandings } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

// GET /api/v1/groups — 12 groups with standings computed from finished group matches.
export async function GET() {
  return NextResponse.json({ data: await groupStandings() });
}
