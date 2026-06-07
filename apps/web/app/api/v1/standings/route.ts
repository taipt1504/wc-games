import { NextResponse } from 'next/server';
import { groupStandings } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

// GET /api/v1/standings — per-group standings (alias of /groups, focused on the table).
export async function GET() {
  return NextResponse.json({ data: await groupStandings() });
}
