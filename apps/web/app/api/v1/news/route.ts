import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function hostOf(url: string | null): string {
  if (!url) return 'GOLAZO wire';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'GOLAZO wire'; }
}

// GET — public news feed. Only PUBLISHED articles are ever exposed (human-in-the-loop,
// PRD §09 ADMIN-05 / §10). UI NewsItem shape.
export async function GET() {
  const articles = await prisma.newsArticle.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  const data = articles.map((a) => ({
    id: Number(a.id),
    tag: a.tags[0] ?? 'News',
    title: a.title,
    src: hostOf(a.sourceUrl),
    time: (a.publishedAt ?? a.createdAt).toISOString().slice(0, 10),
    excerpt: (a.body ?? '').slice(0, 160),
    body: a.body ?? '',
  }));
  return NextResponse.json({ data });
}
