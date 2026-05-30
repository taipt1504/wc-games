import { PrismaClient } from '@wc/db';
import { seedTournament } from './seed';

const prisma = new PrismaClient();

seedTournament(prisma)
  .then((r) => {
    // eslint-disable-next-line no-console
    console.log('Seeded tournament:', r);
    return prisma.$disconnect();
  })
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  });
