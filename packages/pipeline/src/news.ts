/**
 * News pipeline service — AI draft generation + scheduled auto-publish.
 * NEWS-01: generateAndStoreNews (generate drafts into review queue)
 * NEWS-04: publishDueNews (auto-publish scheduled articles)
 */
import type { PrismaClient } from '@wc/db';
import { generateNewsDraft } from '@wc/ai';
import type { LlmGateway } from '@wc/ai';

export interface NewsSource {
  sourceTitle: string;
  sourceUrl?: string;
  model?: string;
}

/** Deterministic seed headlines usable without a live crawl source. */
export const SAMPLE_SOURCES: NewsSource[] = [
  {
    sourceTitle: 'Spain edge Germany in a tactical classic',
    sourceUrl: 'https://goalwire.example/spain-germany',
  },
  {
    sourceTitle: 'Brazil preview: Vinícius set to start against Nigeria',
    sourceUrl: 'https://goalwire.example/brazil-nigeria',
  },
  {
    sourceTitle: 'Transfer buzz: midfielder eyeing a summer switch',
    sourceUrl: 'https://mercato.example/buzz',
  },
];

function inferTags(title: string): string[] {
  const t = title.toLowerCase();
  if (t.includes('transfer') || t.includes('buzz') || t.includes('switch')) return ['Transfer Buzz'];
  if (t.includes('preview') || t.includes('set to')) return ['Match Preview'];
  if (t.includes('result') || t.includes('edge') || t.includes('beat') || t.includes('win')) return ['Result'];
  return ['AI draft'];
}

/**
 * For each source: generate a draft via the gateway, persist a NewsArticle (status PENDING)
 * and an AiJob (type 'news'). Returns the count of articles stored.
 */
export async function generateAndStoreNews(
  prisma: PrismaClient,
  gateway: LlmGateway,
  sources: NewsSource[],
): Promise<number> {
  let stored = 0;
  for (const source of sources) {
    const draft = await generateNewsDraft(gateway, {
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      model: source.model,
    });

    const job = await prisma.aiJob.create({
      data: {
        type: 'news',
        providerUsed: source.model ?? 'gateway',
        status: 'ok',
      },
    });

    await prisma.newsArticle.create({
      data: {
        title: draft.title,
        body: draft.body,
        tags: inferTags(draft.title),
        sourceUrl: draft.sourceUrl,
        aiJobId: job.id,
        status: 'PENDING',
      },
    });

    stored++;
  }
  return stored;
}

/**
 * Find all PENDING articles with a past publishedAt and mark them PUBLISHED.
 * Plain review-queue drafts (publishedAt = null) are untouched.
 * Returns the number of articles published.
 */
export async function publishDueNews(prisma: PrismaClient, now = new Date()): Promise<number> {
  const result = await prisma.newsArticle.updateMany({
    where: {
      status: 'PENDING',
      publishedAt: { not: null, lte: now },
    },
    data: { status: 'PUBLISHED' },
  });
  return result.count;
}
