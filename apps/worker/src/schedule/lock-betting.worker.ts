import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { isJobEnabled, recordJobRun } from '@wc/pipeline';
import { publishEvent, channels } from '@wc/realtime';
import { connection } from '../redis';

interface LockJob { matchId: string }

/**
 * LockBettingWorker — consumes "lock-betting" (scheduled at kickoff − leadMinutes). Hard-locks
 * betting on a match. Idempotent: only acts on SCHEDULED, not-yet-locked matches.
 */
@Injectable()
export class LockBettingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LockBettingWorker.name);
  private worker?: Worker;

  onModuleInit() {
    this.worker = new Worker<LockJob>(
      'lock-betting',
      async (job: Job<LockJob>) => {
        if (!(await isJobEnabled(prisma, 'lock_betting'))) {
          await recordJobRun(prisma, 'lock_betting', 'SKIPPED', 'disabled');
          return { skipped: true };
        }
        const id = BigInt(job.data.matchId);
        const match = await prisma.match.findUnique({ where: { id }, select: { status: true, bettingLocked: true } });
        if (match && match.status === 'SCHEDULED' && !match.bettingLocked) {
          await prisma.match.update({ where: { id }, data: { bettingLocked: true } });
          await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) });
          await recordJobRun(prisma, 'lock_betting', 'OK', `locked match ${id}`);
          this.log.log(`lock-betting: locked match ${id}`);
        } else {
          await recordJobRun(prisma, 'lock_betting', 'OK', `noop match ${id}`);
        }
        return { matchId: job.data.matchId };
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error(`lock-betting job ${job?.id} failed: ${err.message}`);
      void recordJobRun(prisma, 'lock_betting', 'ERROR', err.message);
    });
    this.log.log('LockBettingWorker listening on queue "lock-betting".');
  }

  async onModuleDestroy() { await this.worker?.close(); }
}
