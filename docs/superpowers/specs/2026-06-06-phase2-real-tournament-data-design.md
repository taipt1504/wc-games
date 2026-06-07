# Phase 2 — Real Tournament Data + AI Pipeline — Design

> Date: 2026-06-06 · Status: Approved (design) · Scope: `packages/pipeline`, `packages/db` (no schema change), `apps/web`, `apps/worker`, `packages/ai`
> Sources: PRD [14 data-model], [15 data-pipeline-ai], [10 news]; SD `2026-05-30-data-ai-pipeline-service-design.md`; review `docs/reviews/review-060626-v1.md`.

## Goal

Replace the synthetic tournament dataset with **real WC2026 data** and render it from the DB/API (no client-side mock); add the **AI pipeline** (player-crawl, news, Pundit, live scores).

Done when: teams / groups / standings / fixtures render from real DB data via API (no `WC` mock); players + news + live updates come from the AI/ingest pipeline.

## Key facts (verified this session)

- **Current data is synthetic**: `@wc/fixtures` procedurally generates teams' group draw, match scores (`rng()`), odds, and player names. DB seeded from it = fake.
- **Data source = `worldcup26.ir`** (rezarahiminia/worldcup2026), **keyless for GET** (verified HTTP 200, no token). Real draw + flags.
  - `/get/teams` → 48: `id`(string), `name_en`, `fifa_code`, `flag`(url), `iso2`, `groups`(A–L). **No fifa_rank, no players.**
  - `/get/groups` → 12 + standings (`pts`,`gf`,`ga` per `team_id`).
  - `/get/games` → **104** (group+knockout): `id`, `home_team_id`,`away_team_id`(strings), `home_score`,`away_score`, `group`, `local_date`(MM/DD/YYYY HH:MM), `finished`(TRUE/FALSE), `type`(group|r32|r16|qf|sf|third|final), `stadium_id`, `home/away_team_label`. **No odds.**
  - `/get/stadiums` → 16: `name_en`,`city_en`,`country_en`,`capacity`. Rate limit 500/60s.
- **DB state**: predictions=0, settlements=0, lobbyMatchOdds=0; ledger = SIGNUP×5 + DAILY×1 only. → the re-ingest wipe touches **zero** ledger/prediction/wallet rows.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Data source | worldcup26.ir (keyless GET) |
| 2 | Re-ingest | **Destructive replace** of tournament tables only; API ids become canonical PKs |
| 3 | Odds | House-generated deterministic line (`source=ADMIN`) — rank-free heuristic (API has no rank) |
| 4 | Players | **AI-crawl via 9router** (2B) |
| 5 | AI / 9router | creds in `.env` (`LLM_GATEWAY_*`) → 2B in scope |

## Decomposition (build in order, stop for review between)

### 2A-1 — Ingest + read APIs (backend, no AI, no creds)

**Ingest** — `packages/pipeline/src/ingest.ts`: `ingestTournament(prisma, fetchJson)`.
- Inject `fetchJson(path)` (defaults to `worldcup26.ir`) so the mapper is testable with fixtures.
- Mapper (pure, unit-tested): `name_en`→name, `fifa_code`→code, `flag`→flagUrl, `groups`→Group; string `id`→`BigInt`; `type`→`MatchRound` (group→GROUP, r32→R32, r16→R16, qf→QF, sf→SF, third→THIRD, final→FINAL); `finished`→status (TRUE→FINISHED else SCHEDULED); scores; `local_date`→`kickoffAt`.
- **Wipe (FK-safe, tournament only)**: `matchOdds`→`match`→`player`→`team`→`venue`→`group` deleteMany, in one tx. No ledger/prediction touched (all 0).
- Upsert Group(A–L), Venue (id from stadium id), Team (API id as PK), Match (API id as PK), MatchOdds (house line).
- **House odds** (rank-free): deterministic per match id, mild home edge, e.g. `mHome≈1.6, mDraw≈2.0, mAway≈1.8` jittered by `seed(matchId)`; `source=ADMIN`. (Real odds API / AI-crawl deferred.)
- `fifaRank` left null (API has none).
- Entry points: `pnpm --filter @wc/pipeline ingest` CLI + an `apps/worker` `IngestWorker` (scheduled).

**Read APIs** (`apps/web/app/api/v1/...`, read DB, `force-dynamic`):
- `GET /teams` (`?group=`) · `GET /teams/:id` (team + players[] + its matches) · `GET /groups` (teams + computed standings) · `GET /standings` · `GET /matches` (`?team=&round=&date=`) · `GET /matches/:id`.
- **Standings** computed server-side from FINISHED group matches (W/D/L/GF/GA/Pts/GD, sorted). Pre-tournament → all zeros (correct).

### 2A-2 — Frontend de-mock (display only)

- `screens-tournament.tsx` (Teams, TeamDetail, Groups, Bracket) + `screens-match.tsx` (Schedule, MatchDetail) fetch the new APIs instead of importing `WC`.
- **Scope guard**: only swap the *tournament data source*. Do **not** gut `lib/wc.ts` exports still used by Phases 3–5 (`WC.me`, lobby/leaderboard/admin stubs, `fmtDate`, types). Keep loading/empty/error states.
- TeamDetail roster → empty "squad coming soon" state until 2B.

### 2B — AI pipeline (needs `LLM_GATEWAY_*`)

- **Player AI-crawl**: worker job → LLM (JSON schema) crawls squads from whitelist → validate names → `Player` rows; surfaced read-only. Grounding per PRD §15.5 (no invented players).
- **News worker** (`apps/worker/src/news`): crawl whitelist → LLM rewrite/summarize + tag → `NewsArticle PENDING` → existing admin approve→PUBLISHED flow; cite source.
- **AI Pundit**: `packages/ai` preview/smart-pick grounded on DB; cache in `AiPreview`; disclaimer.
- **LiveScore worker**: poll `/get/games` for LIVE/finished → update scores/status → emit `match.finished` (settlement trigger). Settle stays admin-confirmed (Phase 4).
- Every LLM call logs `AiJob` (provider/tokens/cost/latency/status).

## Error handling

- worldcup26.ir down / rate-limited → keep last DB state + log; ingest is idempotent, safe to retry.
- LLM down (2B) → degrade (skip preview, keep structured data); news stays PENDING.
- Odds always present (house line) so the bet flow never breaks.

## Testing

- **Mapper unit test** (deterministic): captured real JSON fixtures (`teams`/`groups`/`games`/`stadiums`) → assert mapping to Prisma shapes (id→BigInt, type→MatchRound, etc.). **No live API call in CI.**
- **Ingest integration** (test DB): run against fixtures → assert counts (48 teams, 104 matches, 16 venues, 12 groups) + shape; **do not** assert scores/standings (pre-tournament = empty/zero — correct).
- **Read APIs**: unit/integration for `/teams`,`/groups`,`/standings` shape; standings math from seeded finished matches.
- Live API: one-shot manual smoke check, not CI.
- Frontend: existing tests stay green; tournament screens render from mocked fetch.

## Flags / known states

- **Pre-tournament emptiness is correct**: today 2026-06-06, WC starts Jun 11 → all matches SCHEDULED, scores null, standings 0-0-0, knockout = label placeholders ("Winner Group A"). Don't fake-populate. Verify on counts/shape, not scores.
- House odds are flat-ish without FIFA rank — acceptable; revisit when an odds/rank source lands.
- No schema change, no new dependency. worldcup26.ir keyless (no secret). `.env` untouched (user adds `LLM_GATEWAY_*` for 2B).

## Stop-conditions

None for 2A (no dep, no migration, no secret). 2B uses `LLM_GATEWAY_*` (user-provided). Destructive re-ingest approved (tournament tables only; zero ledger impact).
