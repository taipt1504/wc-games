import { Module } from '@nestjs/common';
import { LlmGateway } from './llm/llm-gateway';
import { SettlementWorker } from './settlement/settlement.worker';
import { NewsWorker } from './news/news.worker';
import { LiveScoreWorker } from './livescore/livescore.worker';
import { MatchSchedulerService } from './schedule/match-scheduler.service';
import { LineupWorker } from './schedule/lineup.worker';
import { ResultCheckWorker } from './schedule/result-check.worker';
import { LockBettingWorker } from './schedule/lock-betting.worker';
import { ControlWorker } from './schedule/control.worker';
import { FdSyncWorker } from './footballdata/fd-sync.worker';
import { LineupEnrichWorker } from './footballdata/lineup-enrich.worker';

@Module({
  providers: [
    LlmGateway, SettlementWorker, NewsWorker, LiveScoreWorker,
    MatchSchedulerService, LineupWorker, ResultCheckWorker,
    LockBettingWorker, ControlWorker, FdSyncWorker, LineupEnrichWorker,
  ],
})
export class AppModule {}
