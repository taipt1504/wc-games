import { PrismaClient } from '@wc/db';
import { seedTournament, seedSpecialMarkets } from './seed';

const prisma = new PrismaClient();

(async () => {
  const t = await seedTournament(prisma);
  const s = await seedSpecialMarkets(prisma);
  // eslint-disable-next-line no-console
  console.log('Seeded tournament:', t, 'specials:', s);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', e);
  process.exit(1);
});
