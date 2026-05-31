import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { generateAndStoreNews, publishDueNews } from './news';
import type { LlmGateway } from '@wc/ai';

const prisma = new PrismaClient();

const fakeGateway: LlmGateway = {
  complete: async () => 'Generated body text.',
};

async function clean() {
  await prisma.newsArticle.deleteMany();
  await prisma.aiJob.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('generateAndStoreNews (integration · Postgres)', () => {
  it('stores 1 PENDING NewsArticle + 1 AiJob for a single source', async () => {
    const count = await generateAndStoreNews(prisma, fakeGateway, [{ sourceTitle: 'X' }]);
    expect(count).toBe(1);

    const article = await prisma.newsArticle.findFirst({ where: { title: 'X' } });
    expect(article).not.toBeNull();
    expect(article!.status).toBe('PENDING');
    expect(article!.aiJobId).not.toBeNull();

    const job = await prisma.aiJob.findUnique({ where: { id: article!.aiJobId! } });
    expect(job).not.toBeNull();
    expect(job!.type).toBe('news');
    expect(job!.status).toBe('ok');
  });
});

describe('publishDueNews (integration · Postgres)', () => {
  it('publishes articles with status PENDING and publishedAt in the past', async () => {
    await clean();
    const past = new Date(Date.now() - 60_000);
    await prisma.newsArticle.create({
      data: { title: 'Scheduled past', body: 'body', tags: [], status: 'PENDING', publishedAt: past },
    });

    const count = await publishDueNews(prisma);
    expect(count).toBe(1);

    const article = await prisma.newsArticle.findFirst({ where: { title: 'Scheduled past' } });
    expect(article!.status).toBe('PUBLISHED');
  });

  it('does NOT touch PENDING articles with publishedAt = null (plain drafts)', async () => {
    await clean();
    await prisma.newsArticle.create({
      data: { title: 'Plain draft', body: 'body', tags: [], status: 'PENDING', publishedAt: null },
    });

    const count = await publishDueNews(prisma);
    expect(count).toBe(0);

    const article = await prisma.newsArticle.findFirst({ where: { title: 'Plain draft' } });
    expect(article!.status).toBe('PENDING');
  });
});
