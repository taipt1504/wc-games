import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { settleMatch } from '@wc/prediction';
import { connection } from '../redis';

interface SettleJob {
  matchId: string;
}

/**
 * SettlementWorker — consumes queue "settle" (Prediction & Scoring SD, UC-07).
 * Reads the finished match's 90' score from the DB and runs the idempotent
 * settlement service (escrow payout + ledger + ROI stats) from @wc/prediction.
 */
@Injectable()
export class SettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SettlementWorker.name);
  private worker?: Worker;

  onModuleInit() {
    this.worker = new Worker<SettleJob>(
      'settle',
      async (job: Job<SettleJob>) => {
        const matchId = BigInt(job.data.matchId);
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match || match.scoreHome90 == null || match.scoreAway90 == null) {
          this.log.warn(`settle skipped: match ${matchId} has no final score`);
          return { skipped: true };
        }
        const result = await settleMatch(prisma, matchId, {
          home: match.scoreHome90,
          away: match.scoreAway90,
        });
        this.log.log(`settled match ${matchId}: ${JSON.stringify(result)}`);
        // TODO: enqueue leaderboard.recompute + bracket.score (knockout); publish settled (Realtime GW)
        return result;
      },
      { connection },
    );

    this.worker.on('failed', (job, err) => this.log.error(`job ${job?.id} failed: ${err.message}`));
    this.log.log('SettlementWorker listening on queue "settle".');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
