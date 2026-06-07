import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { prisma } from '@wc/db';
import { lineupDelayMs, firstResultCheckDelayMs } from '@wc/pipeline';
import { connection } from '../redis';

/**
 * MatchScheduler — on startup + hourly, ensures each near-term match has its delayed jobs:
 *   - "lineup"        at kickoff − 15min  → AI-generate the projected XI (LineupWorker).
 *   - "result-check"  at kickoff + 135min → poll the real feed result, then auto-settle (ResultCheckWorker).
 * Deterministic jobIds make re-scans idempotent (BullMQ dedups by id), so this is restart-safe.
 */
const SCAN_BEHIND_MS = 6 * 3_600_000; // include matches kicked off up to 6h ago (still need result checks)
const SCAN_AHEAD_MS = 36 * 3_600_000; // schedule jobs for matches in the next 36h
const RESCAN_MS = 60 * 60_000;

@Injectable()
export class MatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchSchedulerService.name);
  private readonly lineupQ = new Queue('lineup', { connection });
  private readonly resultQ = new Queue('result-check', { connection });
  private tick?: ReturnType<typeof setInterval>;

  onModuleInit() {
    void this.scan();
    this.tick = setInterval(() => void this.scan(), RESCAN_MS);
    this.log.log('MatchScheduler: lineup (T-15m) + result-check (T+135m) jobs, rescan hourly.');
  }

  private async scan() {
    const now = Date.now();
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'LIVE'] },
          kickoffAt: { gte: new Date(now - SCAN_BEHIND_MS), lte: new Date(now + SCAN_AHEAD_MS) },
        },
        select: { id: true, kickoffAt: true },
      });
      for (const m of matches) {
        const id = m.id.toString();
        await this.lineupQ.add('lineup', { matchId: id }, { delay: lineupDelayMs(m.kickoffAt, now), jobId: `lineup:${id}` });
        await this.resultQ.add('check', { matchId: id, attempt: 0 }, { delay: firstResultCheckDelayMs(m.kickoffAt, now), jobId: `result:${id}:0` });
      }
      if (matches.length) this.log.log(`MatchScheduler: ensured jobs for ${matches.length} match(es).`);
    } catch (err) {
      this.log.warn(`MatchScheduler scan failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.tick) clearInterval(this.tick);
    await this.lineupQ.close();
    await this.resultQ.close();
  }
}
