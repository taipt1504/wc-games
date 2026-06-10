/**
 * Manual one-shot football-data sync (P1 verification). Needs SPORTS_API_KEY + SPORTS_API_BASE_URL.
 * Order matters: teams first (sets Team.externalId) so matches can resolve team ids.
 *   pnpm --filter @wc/pipeline ingest:fd
 */
import { prisma } from '@wc/db';
import { fdClientFromEnv, syncTeamsAndSquads, syncMatches } from './index';

async function main() {
  const client = fdClientFromEnv();
  console.log('syncing teams + squads…');
  const t = await syncTeamsAndSquads(prisma, client);
  console.log('teams:', t);
  console.log('syncing matches…');
  const m = await syncMatches(prisma, client);
  console.log('matches:', m);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
