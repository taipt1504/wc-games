import { Module } from '@nestjs/common';
import { LlmGateway } from './llm/llm-gateway';
import { SettlementWorker } from './settlement/settlement.worker';

@Module({
  providers: [LlmGateway, SettlementWorker],
})
export class AppModule {}
