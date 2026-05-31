import { Module } from '@nestjs/common';
import { LlmGateway } from './llm/llm-gateway';
import { SettlementWorker } from './settlement/settlement.worker';
import { NewsWorker } from './news/news.worker';

@Module({
  providers: [LlmGateway, SettlementWorker, NewsWorker],
})
export class AppModule {}
