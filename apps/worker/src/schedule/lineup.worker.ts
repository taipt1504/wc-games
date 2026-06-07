import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { refreshMatchLineups } from '@wc/pipeline';
import { LlmGateway } from '../llm/llm-gateway';
import { connection } from '../redis';

interface LineupJob { matchId: string }

/**
 * LineupWorker — consumes queue "lineup" (scheduled at kickoff − 15min). AI-generates the projected
 * starting XI for the match's two teams (grounded LLM) and stores it on Player/Team. AI-assisted →
 * labelled in the UI; results stay feed-driven (this only fills lineups the free API lacks).
 */
@Injectable()
export class LineupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LineupWorker.name);
  private worker?: Worker;

  constructor(private readonly llm: LlmGateway) {}

  onModuleInit() {
    this.worker = new Worker<LineupJob>(
      'lineup',
      async (job: Job<LineupJob>) => {
        const matchId = BigInt(job.data.matchId);
        const res = await refreshMatchLineups(prisma, this.llm, matchId);
        this.log.log(`lineup match ${matchId}: ${JSON.stringify(res)}`);
        return res;
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => this.log.error(`lineup job ${job?.id} failed: ${err.message}`));
    this.log.log('LineupWorker listening on queue "lineup".');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
