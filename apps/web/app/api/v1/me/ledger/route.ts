import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  SIGNUP: 'Welcome bonus',
  DAILY: 'Daily check-in',
  LOBBY_DEFAULT: 'Lobby starting points',
  STAKE: 'Stake placed',
  SETTLE: 'Bet settled',
  VOID: 'Bet voided (refund)',
  BORROW: 'Borrowed points',
  REFERRAL: 'Referral bonus',
  PURCHASE: 'Purchase',
  ADMIN_ADJ: 'Adjustment',
};

// Returns the user's GLOBAL point ledger in the UI shape ({ type, label, delta, when, bal }).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const rows = await prisma.pointLedger.findMany({
    where: { userId: user.id, contextType: 'GLOBAL' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const data = rows.map((r) => ({
    type: r.type,
    label: LABEL[r.type] ?? r.type,
    delta: Number(r.amount),
    when: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    bal: Number(r.balanceAfter),
  }));
  return NextResponse.json({ data });
}
