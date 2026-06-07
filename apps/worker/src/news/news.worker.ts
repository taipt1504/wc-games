import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { generateAndStoreNews, publishDueNews, crawlNewsSources, SAMPLE_SOURCES, getJobConfig, isJobEnabled, recordJobRun, backfillNewsTranslations } from '@wc/pipeline';
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
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

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

    // Config-driven publish loop — auto-publish scheduled articles.
    void this.loop();
  }

  /** Publish due articles; also the manual-trigger entry point. Returns a short status note. */
  async runOnce(): Promise<string> {
    try {
      if (!(await isJobEnabled(prisma, 'news'))) {
        await recordJobRun(prisma, 'news', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      const n = await publishDueNews(prisma);
      if (n > 0) this.log.log(`auto-published ${n} scheduled news article(s)`);
      // Backfill VI translations for articles still missing them (self-healing, small batch/cycle).
      const vi = await backfillNewsTranslations(prisma, this.llm, { limit: 5 }).catch(() => 0);
      if (vi > 0) this.log.log(`backfilled ${vi} VI translation(s)`);
      await recordJobRun(prisma, 'news', 'OK', `published ${n} · vi+${vi}`);
      return `published ${n} · vi+${vi}`;
    } catch (err) {
      await recordJobRun(prisma, 'news', 'ERROR', (err as Error).message);
      this.log.error(`publishDueNews error: ${(err as Error).message}`);
      return 'error';
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { publishIntervalSeconds } = await getJobConfig(prisma, 'news');
    this.timer = setTimeout(() => void this.loop(), publishIntervalSeconds * 1000);
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.worker?.close();
  }
}
