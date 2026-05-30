import { config } from 'dotenv';
import { resolve } from 'node:path';
// .env nằm ở repo root (apps/worker/{src,dist} -> lên 3 cấp = root).
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('WC2026 worker started (queue: settle). Ctrl+C để dừng.');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
