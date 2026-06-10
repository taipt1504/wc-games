import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type JobKey } from '@wc/pipeline';
import { createSubscriber, channels } from '@wc/realtime';
import { MatchSchedulerService } from './match-scheduler.service';
import { LiveScoreWorker } from '../livescore/livescore.worker';
import { NewsWorker } from '../news/news.worker';
import { FdSyncWorker } from '../footballdata/fd-sync.worker';
import { LineupEnrichWorker } from '../footballdata/lineup-enrich.worker';

/**
 * ControlWorker — subscribes to the Redis "job.control" channel (admin "Run now" publishes via
 * @wc/realtime). Dispatches a one-off run of the global jobs; the per-match jobs
 * (lineup/result_check/lock_betting) force a scheduler scan — per-match one-offs already exist via
 * the sync-lineup/sync-result admin routes. Fire-and-forget (manual trigger, no queue durability).
 */
@Injectable()
export class ControlWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ControlWorker.name);
  private sub?: { close: () => void };

  constructor(
    private readonly scheduler: MatchSchedulerService,
    private readonly liveScore: LiveScoreWorker,
    private readonly news: NewsWorker,
    private readonly fdSync: FdSyncWorker,
    private readonly lineupEnrich: LineupEnrichWorker,
  ) {}

  onModuleInit() {
    this.sub = createSubscriber([channels.control], (_ch, ev) => {
      if (ev.type !== 'job.trigger') return;
      void this.dispatch(ev.key as JobKey);
    });
    this.log.log('ControlWorker subscribed to "job.control".');
  }

  private async dispatch(key: JobKey) {
    this.log.log(`manual trigger: ${key}`);
    try {
      switch (key) {
        case 'livescore': await this.liveScore.runOnce(); break;
        case 'news': await this.news.runOnce(); break;
        case 'fd_sync': await this.fdSync.runOnce(); break;
        case 'enrich_lineups': await this.lineupEnrich.runOnce(); break;
        case 'scheduler_scan':
        case 'lineup':
        case 'result_check':
        case 'lock_betting':
          await this.scheduler.scan(); break;
        default: this.log.warn(`manual trigger: unknown key ${key}`);
      }
    } catch (err) {
      this.log.error(`manual trigger ${key} failed: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() { this.sub?.close(); }
}
