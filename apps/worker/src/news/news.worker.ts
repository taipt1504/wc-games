import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { generateAndStoreNews, publishDueNews, crawlNewsSources, SAMPLE_SOURCES } from '@wc/pipeline';
import { LlmGateway } from '../llm/llm-gateway';
import { connection } from '../redis';

interface NewsGenerateJob {
  sources?: { sourceTitle: string; sourceUrl?: string }[];
}

/**
 * NewsWorker — thin wrapper around generateAndStoreNews + publishDueNews.
 * Queue "news": consume generate-draft jobs.
 * setInterval: auto-publish scheduled articles every 60 s.
 */
@Injectable()
export class NewsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(NewsWorker.name);
  private worker?: Worker;
  private publishTick?: ReturnType<typeof setInterval>;

  constructor(private readonly llm: LlmGateway) {}

  onModuleInit() {
    // BullMQ worker: generate news drafts on demand.
    this.worker = new Worker<NewsGenerateJob>(
      'news',
      async (job: Job<NewsGenerateJob>) => {
        let sources = job.data.sources ?? (await crawlNewsSources().catch(() => []));
        if (sources.length === 0) sources = SAMPLE_SOURCES;
        const count = await generateAndStoreNews(prisma, this.llm, sources);
        this.log.log(`news generate job ${job.id}: stored ${count} drafts`);
        return { count };
      },
      { connection },
    );
    this.worker.on('failed', (job, err) =>
      this.log.error(`news job ${job?.id} failed: ${err.message}`),
    );
    this.log.log('NewsWorker listening on queue "news".');

    // Repeatable publish tick — auto-publish scheduled articles.
    this.publishTick = setInterval(async () => {
      try {
        const n = await publishDueNews(prisma);
        if (n > 0) this.log.log(`auto-published ${n} scheduled news article(s)`);
      } catch (err) {
        this.log.error(`publishDueNews error: ${(err as Error).message}`);
      }
    }, 60_000);
  }

  async onModuleDestroy() {
    if (this.publishTick) clearInterval(this.publishTick);
    await this.worker?.close();
  }
}
