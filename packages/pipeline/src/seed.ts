/**
 * @wc/pipeline — tournament data ingest (deterministic seed from @wc/fixtures).
 * Represents the "free-provider / ingest" path of PRD §15. Explicit ids keep the
 * DB aligned with the web UI's fixtures so bets reference real matches.
 * (AI crawl / news / pundit via 9router is the worker's LlmGateway domain.)
 */
import type { PrismaClient, MatchStatus, Outcome } from '@wc/db';
import { teams, matches, GROUPS } from '@wc/fixtures';

function kickoffAt(date: Date, kickoff: string): Date {
  const [h, m] = kickoff.split(':').map(Number);
  const d = new Date(date);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function result90(hs: number | null, as: number | null): Outcome | undefined {
  if (hs == null || as == null) return undefined;
  return (hs > as ? 'HOME' : hs < as ? 'AWAY' : 'DRAW') as Outcome;
}

export async function seedTournament(prisma: PrismaClient): Promise<{ teams: number; matches: number }> {
  // groups A–L
  const groupId: Record<string, bigint> = {};
  for (const name of GROUPS) {
    const g = await prisma.group.upsert({ where: { name }, create: { name }, update: {} });
    groupId[name] = g.id;
  }

  // 48 teams (explicit ids matching @wc/fixtures)
  for (const t of teams) {
    const data = { name: t.name, code: t.code, fifaRank: t.rank, groupId: groupId[t.group] };
    await prisma.team.upsert({ where: { id: BigInt(t.id) }, create: { id: BigInt(t.id), ...data }, update: data });
  }

  // 72 group matches + odds
  for (const m of matches) {
    const kAt = kickoffAt(m.date, m.kickoff);
    const r = result90(m.hs, m.as);
    const matchData = {
      round: 'GROUP' as const,
      groupId: groupId[m.group],
      homeTeamId: BigInt(m.home),
      awayTeamId: BigInt(m.away),
      kickoffAt: kAt,
      status: m.status as MatchStatus,
      scoreHome90: m.hs ?? undefined,
      scoreAway90: m.as ?? undefined,
      result90: r,
      source: 'API' as const,
    };
    await prisma.match.upsert({ where: { id: BigInt(m.id) }, create: { id: BigInt(m.id), ...matchData }, update: matchData });
    const oddsData = { mHome: m.odds.mh, mDraw: m.odds.md, mAway: m.odds.ma, source: 'API' as const };
    await prisma.matchOdds.upsert({ where: { matchId: BigInt(m.id) }, create: { matchId: BigInt(m.id), ...oddsData }, update: oddsData });
  }

  return { teams: teams.length, matches: matches.length };
}

// Deterministic AI-draft news for the review queue (ADMIN-05). In production these rows
// are written by the worker's LlmGateway/news job; here they stand in as PENDING drafts so
// the human-in-the-loop approve→PUBLISHED flow is exercisable. Idempotent: skips if any exist.
const NEWS_DRAFTS = [
  {
    title: 'Spain edge Germany in a tactical classic',
    body: 'A disciplined Spain side broke a stubborn Germany with a second-half goal, controlling midfield throughout. For entertainment only — not betting advice.',
    tags: ['Result'],
    sourceUrl: 'https://goalwire.example/spain-germany',
  },
  {
    title: 'Brazil preview: Vinícius set to start against Nigeria',
    body: 'Brazil are expected to field Vinícius from the first whistle as they chase top spot in the group. For entertainment only — not betting advice.',
    tags: ['Match Preview'],
    sourceUrl: 'https://goalwire.example/brazil-nigeria',
  },
  {
    title: 'Transfer buzz: midfielder eyeing a summer switch',
    body: 'Unconfirmed reports link a tournament standout with a move after the finals. Treat as rumour. For entertainment only — not betting advice.',
    tags: ['Transfer Buzz'],
    sourceUrl: 'https://mercato.example/buzz',
  },
];

export async function seedNews(prisma: PrismaClient): Promise<number> {
  if ((await prisma.newsArticle.count()) > 0) return 0; // status defaults to PENDING
  await prisma.newsArticle.createMany({ data: NEWS_DRAFTS });
  return NEWS_DRAFTS.length;
}
