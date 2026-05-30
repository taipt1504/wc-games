import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { connection } from '../redis';

interface SettleJob {
  matchId: string;
}

/**
 * SettlementWorker — consume queue "settle" (Prediction & Scoring SD, UC-07).
 * Hiện là STUB: nhận job, log. Logic settle idempotent + chia điểm sẽ implement ở P0.
 */
@Injectable()
export class SettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SettlementWorker.name);
  private worker?: Worker;

  onModuleInit() {
    this.worker = new Worker<SettleJob>(
      'settle',
      async (job: Job<SettleJob>) => {
        this.log.log(`[stub] settle match ${job.data.matchId}`);
        // TODO (P0) — Prediction & Scoring SD UC-07:
        //  1) pg_advisory_xact_lock(matchId) + guard bảng settlement (idempotent)
        //  2) result_90 từ tỉ số 90'
        //  3) payout từng kèo LOCKED (1X2 + bonus knockout) -> wallet + point_ledger(SETTLE)
        //  4) update prediction_user_stats CHỈ context=GLOBAL (ROI leaderboard)
        //  5) enqueue leaderboard.recompute + bracket.score (knockout); publish settled
        return { ok: true, stub: true };
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
