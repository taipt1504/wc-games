import { PrismaClient } from '@wc/db';
import { createGatewayFromEnv } from '@wc/ai';
import { enrichAllLineups } from './squad';

// Usage: pnpm --filter @wc/pipeline enrich-lineups
const prisma = new PrismaClient();

(async () => {
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) {
    // eslint-disable-next-line no-console
    console.error('No LLM gateway configured (LLM_GATEWAY_BASE_URL/API_KEY). Aborting.');
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('Enriching lineups for all teams…');
  const results = await enrichAllLineups(prisma, gw);
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.team}: ${r.matched} matched, ${r.starters} starters (${r.status})`);
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('enrich-lineups failed:', e);
  process.exit(1);
});
