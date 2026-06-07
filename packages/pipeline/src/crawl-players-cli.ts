import { PrismaClient } from '@wc/db';
import { createGatewayFromEnv } from '@wc/ai';
import { crawlAndStoreSquads } from './squad';

// Usage: pnpm crawl-players [CODE ...]   (no args = all 48 teams; args = those team codes only)
const prisma = new PrismaClient();

(async () => {
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) {
    // eslint-disable-next-line no-console
    console.error('No LLM gateway configured (LLM_GATEWAY_BASE_URL/API_KEY). Aborting.');
    process.exit(1);
  }
  const codes = process.argv.slice(2).map((c) => c.toUpperCase());
  const teams = await prisma.team.findMany({
    where: codes.length ? { code: { in: codes } } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  // eslint-disable-next-line no-console
  console.log(`Crawling squads for ${teams.length} team(s)…`);
  const results = await crawlAndStoreSquads(prisma, gw, teams);
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.team}: ${r.count} players, ${r.starters} starters (${r.status})`);
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('crawl-players failed:', e);
  process.exit(1);
});
