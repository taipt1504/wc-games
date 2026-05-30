import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

function hostOf(url: string | null): string {
  if (!url) return 'AI draft';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'AI draft'; }
}

// GET — news review queue (admin only). PRD §09 ADMIN-05. UI ReviewItem shape.
// PENDING first so the editor sees what needs action; then recently decided.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const articles = await prisma.newsArticle.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const rank = (s: string) => (s === 'PENDING' ? 0 : 1);
  const data = articles
    .sort((a, b) => rank(a.status) - rank(b.status))
    .map((a) => ({
      id: Number(a.id),
      title: a.title,
      tag: a.tags[0] ?? 'News',
      src: hostOf(a.sourceUrl),
      conf: 90,
      status: a.status,
      warn: a.tags.includes('Transfer Buzz'),
    }));
  return NextResponse.json({ data });
}
