import { PrismaClient } from '@wc/db';
import { seedTournament } from '@wc/pipeline';

const TEST_DB = 'postgresql://wc:wc@localhost:5433/wc_game';

/** Seed the test DB with tournament data so real bets reference real matches. */
export default async function globalSetup() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
  const r = await seedTournament(prisma);
  // eslint-disable-next-line no-console
  console.log('[e2e] seeded test DB', r);
  await prisma.$disconnect();
}
