import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { decideResultCheck, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';
import { connection } from '../redis';

interface ResultJob { matchId: string; attempt: number }

/**
 * ResultCheckWorker — consumes queue "result-check". Reads the match's current (live-score feed)
 * state: FINISHED with a 90' score → enqueue "settle" (auto-settle, admin can still resettle);
 * still LIVE / not final (knockout ET/penalties) → re-check in 30min; gives up to admin after the cap.
 */
@Injectable()
export class ResultCheckWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ResultCheckWorker.name);
  private worker?: Worker;
  private readonly settleQ = new Queue('settle', { connection });
  private readonly resultQ = new Queue('result-check', { connection });

  onModuleInit() {
    this.worker = new Worker<ResultJob>(
      'result-check',
      async (job: Job<ResultJob>) => {
        if (!(await isJobEnabled(prisma, 'result_check'))) {
          await recordJobRun(prisma, 'result_check', 'SKIPPED', 'disabled');
          return { action: 'stop' as const, reason: 'disabled' };
        }
        const matchId = BigInt(job.data.matchId);
        const attempt = job.data.attempt ?? 0;
        const cfg = await getJobConfig(prisma, 'result_check');
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          select: { status: true, scoreHome90: true, scoreAway90: true },
        });
        if (!match) return { action: 'stop' as const, reason: 'missing' };

        const action = decideResultCheck(match, attempt, cfg.maxAttempts);
        if (action === 'settle') {
          await this.settleQ.add('settle', { matchId: matchId.toString() }, { jobId: `settle:${matchId}` });
          this.log.log(`result match ${matchId}: FINISHED → enqueued settle`);
        } else if (action === 'recheck') {
          await this.resultQ.add(
            'check',
            { matchId: matchId.toString(), attempt: attempt + 1 },
            { delay: cfg.recheckMinutes * 60_000, jobId: `result:${matchId}:${attempt + 1}` },
          );
          this.log.log(`result match ${matchId}: not final (attempt ${attempt}) → re-check in ${cfg.recheckMinutes}m`);
        } else {
          this.log.warn(`result match ${matchId}: not final after ${attempt} attempts → needs admin confirm`);
        }
        await recordJobRun(prisma, 'result_check', 'OK', `${action} match ${matchId}`);
        return { action };
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error(`result-check job ${job?.id} failed: ${err.message}`);
      void recordJobRun(prisma, 'result_check', 'ERROR', err.message);
    });
    this.log.log('ResultCheckWorker listening on queue "result-check".');
  }

  async onModuleDestroy() {
    await this.settleQ.close();
    await this.resultQ.close();
    await this.worker?.close();
  }
}
