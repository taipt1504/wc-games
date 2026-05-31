import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — approve an AI news draft (human-in-the-loop). PRD §09 ADMIN-05 AC.
// Optional body: { scheduledAt?: string (ISO) }
// - scheduledAt in the future → keep PENDING, set publishedAt = scheduledAt (auto-publish later).
// - no scheduledAt (or in the past) → publish immediately (status=PUBLISHED, publishedAt=now).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { scheduledAt?: string };
  const now = new Date();

  let articleData: { status: 'PUBLISHED' | 'PENDING'; publishedAt: Date };
  if (body.scheduledAt) {
    const scheduled = new Date(body.scheduledAt);
    if (scheduled > now) {
      // Scheduled for the future — stays PENDING; publishedAt signals the worker when to publish.
      articleData = { status: 'PENDING', publishedAt: scheduled };
    } else {
      // scheduledAt is in the past → publish immediately.
      articleData = { status: 'PUBLISHED', publishedAt: now };
    }
  } else {
    articleData = { status: 'PUBLISHED', publishedAt: now };
  }

  const article = await prisma.newsArticle.update({
    where: { id: BigInt(id) },
    data: articleData,
  });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'PUBLISH_NEWS', target: `news:${id}` },
  });
  return NextResponse.json({ data: { id: Number(article.id), status: article.status } });
}
