import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function hostOf(url: string | null): string {
  if (!url) return 'World Cup Games wire';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'World Cup Games wire'; }
}

// GET — public news feed. Only PUBLISHED articles are ever exposed (human-in-the-loop,
// PRD §09 ADMIN-05 / §10). UI NewsItem shape. `?locale=vi` serves the AI Vietnamese
// translation when present, else falls back to the EN title/body.
export async function GET(req: Request) {
  const vi = new URL(req.url).searchParams.get('locale') === 'vi';
  const articles = await prisma.newsArticle.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  const data = articles.map((a) => {
    const title = vi && a.titleVi ? a.titleVi : a.title;
    const body = (vi && a.bodyVi ? a.bodyVi : a.body) ?? '';
    return {
      id: Number(a.id),
      tag: a.tags[0] ?? 'News',
      title,
      src: hostOf(a.sourceUrl),
      time: (a.publishedAt ?? a.createdAt).toISOString().slice(0, 10),
      excerpt: body.slice(0, 160),
      body,
    };
  });
  return NextResponse.json({ data });
}
