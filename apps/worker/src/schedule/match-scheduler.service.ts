import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { prisma } from '@wc/db';
import { lockBettingDelayMs, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';
import { connection } from '../redis';

/**
 * MatchScheduler — on startup + config-driven rescan, ensures each near-term match has its delayed jobs:
 *   - "lineup"        at kickoff − lineup.leadMinutes       → AI projected XI (LineupWorker).
 *   - "lock-betting"  at kickoff − lock_betting.leadMinutes → hard-lock betting (LockBettingWorker).
 *   - "result-check"  at kickoff + result_check.firstDelayMinutes → poll feed + auto-settle (ResultCheckWorker).
 * Thresholds come from the ScheduleJob registry (getJobConfig); disabled jobs are removed, not added.
 * lineup/lock are removed + re-added each scan so threshold edits propagate; the result-check chain
 * manages its own rechecks so only the first attempt is (re)ensured here.
 */
@Injectable()
export class MatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchSchedulerService.name);
  private readonly lineupQ = new Queue('lineup', { connection });
  private readonly resultQ = new Queue('result-check', { connection });
  private readonly lockQ = new Queue('lock-betting', { connection });
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  onModuleInit() {
    void this.loop();
    this.log.log('MatchScheduler: lineup + lock-betting + result-check jobs, config-driven rescan.');
  }

  private async loop() {
    if (this.stopped) return;
    await this.scan();
    const { rescanMinutes } = await getJobConfig(prisma, 'scheduler_scan');
    this.timer = setTimeout(() => void this.loop(), rescanMinutes * 60_000);
  }

  /** Public so ControlWorker can force a scan on manual trigger. */
  async scan() {
    const now = Date.now();
    try {
      const scan = await getJobConfig(prisma, 'scheduler_scan');
      const [lineupOn, resultOn, lockOn] = await Promise.all([
        isJobEnabled(prisma, 'lineup'), isJobEnabled(prisma, 'result_check'), isJobEnabled(prisma, 'lock_betting'),
      ]);
      const lineupCfg = await getJobConfig(prisma, 'lineup');
      const lockCfg = await getJobConfig(prisma, 'lock_betting');
      const resultCfg = await getJobConfig(prisma, 'result_check');

      const matches = await prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'LIVE'] },
          kickoffAt: {
            gte: new Date(now - scan.scanBehindHours * 3_600_000),
            lte: new Date(now + scan.scanAheadHours * 3_600_000),
          },
        },
        select: { id: true, kickoffAt: true },
      });

      for (const m of matches) {
        const id = m.id.toString();
        await this.reschedule(this.lineupQ, `lineup:${id}`, lineupOn, 'lineup', { matchId: id },
          Math.max(0, m.kickoffAt.getTime() - lineupCfg.leadMinutes * 60_000 - now));
        await this.reschedule(this.lockQ, `lock:${id}`, lockOn, 'lock', { matchId: id },
          lockBettingDelayMs(m.kickoffAt, lockCfg.leadMinutes, now));
        if (resultOn) {
          await this.resultQ.add('check', { matchId: id, attempt: 0 },
            { delay: Math.max(0, m.kickoffAt.getTime() + resultCfg.firstDelayMinutes * 60_000 - now), jobId: `result:${id}:0` });
        } else {
          await this.resultQ.remove(`result:${id}:0`).catch(() => {});
        }
      }
      await recordJobRun(prisma, 'scheduler_scan', 'OK', `ensured ${matches.length} match(es)`);
      if (matches.length) this.log.log(`MatchScheduler: ensured jobs for ${matches.length} match(es).`);
    } catch (err) {
      await recordJobRun(prisma, 'scheduler_scan', 'ERROR', (err as Error).message);
      this.log.warn(`MatchScheduler scan failed: ${(err as Error).message}`);
    }
  }

  /** Remove (safe for delayed jobs) then re-add with the current-config delay; skip if disabled. */
  private async reschedule(q: Queue, jobId: string, enabled: boolean, name: string, data: object, delay: number) {
    await q.remove(jobId).catch(() => {});
    if (enabled) await q.add(name, data, { delay, jobId });
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await Promise.all([this.lineupQ.close(), this.resultQ.close(), this.lockQ.close()]);
  }
}
