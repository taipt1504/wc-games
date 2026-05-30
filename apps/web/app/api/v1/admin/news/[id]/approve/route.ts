import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — approve an AI news draft -> PUBLISHED (human-in-the-loop). PRD §09 ADMIN-05 AC.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const article = await prisma.newsArticle.update({
    where: { id: BigInt(id) },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'PUBLISH_NEWS', target: `news:${id}` },
  });
  return NextResponse.json({ data: { id: Number(article.id), status: article.status } });
}
