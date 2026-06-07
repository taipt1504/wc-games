import { PrismaClient } from '@wc/db';
import { ingestTournament } from './ingest';

const prisma = new PrismaClient();

ingestTournament(prisma)
  .then((r) => {
    // eslint-disable-next-line no-console
    console.log('Ingested real WC2026 data:', r);
    return prisma.$disconnect();
  })
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Ingest failed:', e);
    process.exit(1);
  });
