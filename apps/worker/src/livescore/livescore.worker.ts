import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wc/db';
import { updateLiveScores, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';

/**
 * LiveScoreWorker — polls worldcup26.ir on a config-driven cadence and writes current scores/status
 * onto Match (PRD §15 LIVE). Does NOT settle. Plain timer poller (no queue) — independent of Redis.
 * `runOnce()` is also the manual-trigger entry point (ControlWorker).
 */
@Injectable()
export class LiveScoreWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LiveScoreWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;

  onModuleInit() {
    void this.loop();
    this.log.log('LiveScoreWorker polling worldcup26 (config-driven cadence).');
  }

  /** One poll pass; also the manual-trigger entry point. Returns a short status note. */
  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'livescore'))) {
        await recordJobRun(prisma, 'livescore', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      const { updated, newlyFinished } = await updateLiveScores(prisma);
      const note = `updated ${updated}, finished [${newlyFinished.join(',')}]`;
      if (updated > 0) this.log.log(`live scores: ${note}`);
      await recordJobRun(prisma, 'livescore', 'OK', note);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'livescore', 'ERROR', (err as Error).message);
      this.log.warn(`live-score poll failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { intervalSeconds } = await getJobConfig(prisma, 'livescore');
    this.timer = setTimeout(() => void this.loop(), intervalSeconds * 1000);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
