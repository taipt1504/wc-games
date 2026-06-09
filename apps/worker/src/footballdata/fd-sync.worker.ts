import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wc/db';
import {
  fdClientFromEnv, syncMatches, syncTeamsAndSquads, syncScorers,
  getJobConfig, isJobEnabled, recordJobRun,
} from '@wc/pipeline';

/**
 * FdSyncWorker — reference sync from football-data.org on a config-driven cadence (PRD §15).
 * Matches every run (1 call); teams+squads every `teamsEveryRuns` runs (1 call). Plain timer
 * poller (no queue). `runOnce()` is also the manual-trigger entry point (ControlWorker).
 */
@Injectable()
export class FdSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(FdSyncWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;
  private runs = 0;

  onModuleInit() {
    void this.loop();
    this.log.log('FdSyncWorker polling football-data.org (config-driven cadence).');
  }

  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'fd_sync'))) {
        await recordJobRun(prisma, 'fd_sync', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      let client;
      try { client = fdClientFromEnv(); }
      catch (e) {
        await recordJobRun(prisma, 'fd_sync', 'SKIPPED', (e as Error).message);
        return 'no-key';
      }
      const { teamsEveryRuns } = await getJobConfig(prisma, 'fd_sync');
      let note = '';
      if (this.runs % teamsEveryRuns === 0) {
        const t = await syncTeamsAndSquads(prisma, client);
        note += `teams ${t.teams}/${t.players}p${t.unmatched.length ? ` unmatched:${t.unmatched.length}` : ''}; `;
      }
      const m = await syncMatches(prisma, client);
      note += `matches matched ${m.matched}, skippedAdmin ${m.skippedAdmin}, unresolved ${m.unresolved}`;
      const sc = await syncScorers(prisma, client);
      note += `; scorers ${sc.scorers}`;
      this.runs++;
      await recordJobRun(prisma, 'fd_sync', 'OK', note);
      this.log.log(`fd_sync: ${note}`);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'fd_sync', 'ERROR', (err as Error).message);
      this.log.warn(`fd_sync failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { intervalMinutes } = await getJobConfig(prisma, 'fd_sync');
    this.timer = setTimeout(() => void this.loop(), intervalMinutes * 60_000);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
