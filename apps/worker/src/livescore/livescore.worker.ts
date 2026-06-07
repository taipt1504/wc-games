import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wc/db';
import { updateLiveScores } from '@wc/pipeline';

/**
 * LiveScoreWorker — polls worldcup26.ir every 45s and writes current scores/status onto Match
 * (PRD §15 LIVE cadence). Does NOT settle: points settlement stays admin-confirmed (Phase 4).
 * Plain interval poller (no queue) — independent of Redis.
 */
@Injectable()
export class LiveScoreWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LiveScoreWorker.name);
  private tick?: ReturnType<typeof setInterval>;
  private running = false;

  onModuleInit() {
    const poll = async () => {
      if (this.running) return; // skip if a slow poll is still in flight
      this.running = true;
      try {
        const { updated, newlyFinished } = await updateLiveScores(prisma);
        if (updated > 0) this.log.log(`live scores: updated ${updated} match(es), newly finished: [${newlyFinished.join(',')}]`);
      } catch (err) {
        this.log.warn(`live-score poll failed: ${(err as Error).message}`);
      } finally {
        this.running = false;
      }
    };
    void poll();
    this.tick = setInterval(poll, 45_000);
    this.log.log('LiveScoreWorker polling worldcup26 every 45s.');
  }

  onModuleDestroy() {
    if (this.tick) clearInterval(this.tick);
  }
}
