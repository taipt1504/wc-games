import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

function hostOf(url?: string | null): string {
  if (!url) return 'AI draft';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'AI draft'; }
}

// GET /api/v1/admin/news/[id] — full article draft for review (title + body + meta).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const a = await prisma.newsArticle.findUnique({ where: { id: BigInt(id) } });
  if (!a) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  return NextResponse.json({
    data: {
      id: Number(a.id), title: a.title, body: a.body ?? '', tag: a.tags[0] ?? 'News', tags: a.tags,
      src: hostOf(a.sourceUrl), sourceUrl: a.sourceUrl, status: a.status,
      createdAt: a.createdAt, publishedAt: a.publishedAt,
    },
  });
}
