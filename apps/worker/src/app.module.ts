import { Module } from '@nestjs/common';
import { LlmGateway } from './llm/llm-gateway';
import { SettlementWorker } from './settlement/settlement.worker';
import { NewsWorker } from './news/news.worker';
import { LiveScoreWorker } from './livescore/livescore.worker';
import { MatchSchedulerService } from './schedule/match-scheduler.service';
import { LineupWorker } from './schedule/lineup.worker';
import { ResultCheckWorker } from './schedule/result-check.worker';

@Module({
  providers: [
    LlmGateway, SettlementWorker, NewsWorker, LiveScoreWorker,
    MatchSchedulerService, LineupWorker, ResultCheckWorker,
  ],
})
export class AppModule {}
