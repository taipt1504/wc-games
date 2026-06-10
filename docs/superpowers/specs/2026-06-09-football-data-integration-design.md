# Football-Data.org Integration — Design (PHASE 0)

**Date:** 2026-06-09
**Goal:** Replace the current tournament data source (worldcup26.ir + `@wc/fixtures` synthetic seed) with real data from **football-data.org API v4** (competition `WC`), behind a single rate-limited client, fetched on a schedule by `apps/worker`, cached in Postgres, and read by `apps/web` from existing internal APIs. Enhance match UI with real fields, integrate the live status workflow, and add a Top Scorers feature.

**Scope:** `apps/web`, `apps/worker`, `packages/{db,pipeline,fixtures,core,ai}`. No changes to `.env`, `pnpm-lock.yaml`, `docker-compose.yml`, or already-committed migrations. Frontend changes are CSS/render only; logic lives in worker/pipeline.

---

## 1. Verification (done — live API + DB, 2026-06-09)

Confirmed against the real API with a one-off key (HTTP 200 on all six endpoints; rate budget header `x-requests-available-minute: 10`):

| Endpoint | Result |
|---|---|
| `GET /v4/competitions/WC` | `type: CUP`, season `2026-06-11 → 2026-07-19`, `currentMatchday: 1` |
| `GET /v4/competitions/WC/matches` | `resultSet.count: 104`, stages `GROUP_STAGE / LAST_32 / LAST_16 / QUARTER_FINALS / SEMI_FINALS / THIRD_PLACE / FINAL`, groups `GROUP_A..GROUP_L`, all `status: TIMED` (not started, `played: 0`) |
| `GET /v4/competitions/WC/teams` | `count: 48`; each team includes **inline `squad[]` (26 players)** + `coach`, `tla`, `crest`, `clubColors`, `founded`. Player = `{id, name, position, dateOfBirth, nationality}` |
| `GET /v4/competitions/WC/standings` | **Works for WC** (no 404) — 12 group tables, full `position/playedGames/won/draw/lost/points/goalsFor/goalsAgainst/goalDifference` |
| `GET /v4/competitions/WC/scorers` | `count: 0` (empty until matches played); shape `scorers[].{player, team, goals, assists, penalties}` |
| `GET /v4/matches/537327` | adds `venue, minute, injuryTime, attendance, homeTeam.{formation,lineup,bench,coach}, score.{fullTime,halfTime,winner,duration}, goals[], bookings[], substitutions[], referees[]` |

**Hard realities discovered (no guessing):**
- `venue` is **null** in both list and single-match responses (pre-tournament; may or may not populate). **football-data does not reliably supply venue for WC.**
- `odds` is **locked** (`"Activate Odds-Package in User-Panel"`). Odds stay internal (the app already generates house odds).
- Squad `position` is coarse (`Goalkeeper / Defence / Midfield / Offence`) and the bulk teams call has **no shirt number**. The AI lineup worker still supplements specific positions + numbers near kickoff.
- `score.duration` distinguishes `REGULAR / EXTRA_TIME / PENALTY_SHOOTOUT`; `score.fullTime` for knockouts includes ET/pens. Our schema stores only `scoreHome90/Away90` — we store `fullTime` as-is and accept that "90" is a label, not a guarantee, for knockouts.

**Current DB state (a working demo, not empty):** `match: 104, team: 48, player: 1104, venue: 16, user: 13`. Match IDs are synthetic (`1, 2, 28…`), team IDs `1, 2, 3…` — **not** football-data's (`537327 / 769`), though the fixtures line up (DB match 1 = MEX v RSA = FD 537327). Referencing rows: **`prediction: 6, settlement: 6, lobbyMatchOdds: 1, aiJob: 22`**; `bracket/parlay/microPrediction: 0`. DB also holds demo FINISHED results.

---

## 2. Decisions (approved 2026-06-09)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | **Data identity** | Keep synthetic PKs; add nullable `externalId` to `Team`, `Match`, `Player`. First sync resolves FD rows → DB rows by natural key, stores the FD id, upserts by it after. | Preserves 6 demo predictions/settlements + 16 venue links. **Requires a migration (gate at P1).** |
| D2 | **Top Scorers** | Add a `Scorer` model + a Top Scorers page fed by `/scorers`. | **Requires a migration (gate at P4).** Empty until matches played. |
| D3 | **Live polling** | Bulk `GET /competitions/WC/matches?status=LIVE` once per cycle (~60s) for all live scores; reserve `/matches/{id}` for when a user opens a match. | ~1 req/min for live regardless of concurrent matches. Deviates from the literal "per-match" wording in PHASE 3 — approved. |
| D4 | **Standings** | Keep computed-from-matches (no `Standing` model, no extra call). | Tiebreakers remain our own logic; may differ from FIFA's official order in rare edge cases. |
| D5 | **Venue** | Keep the existing 16 DB venues + their match links. | FD venue is null; we do not overwrite or invent it. |
| D6 | **Odds** | Unchanged — internal house odds. | FD odds are paywalled; not used. |
| D7 | **Env var** | Reuse existing empty `SPORTS_API_KEY` + `SPORTS_API_BASE_URL` (`https://api.football-data.org/v4`). | User populates both at P1 (we never touch `.env`). |

---

## 3. Architecture

### 3.1 Single rate-limited client — `packages/pipeline/src/football-data.ts` (new)

One module, one client instance, all football-data traffic funnels through it. No scattered `fetch`.

- **Auth:** `X-Auth-Token` header from `process.env.SPORTS_API_KEY`; base URL from `process.env.SPORTS_API_BASE_URL`. Missing key → throw a clear error (job records failure, does not crash the worker).
- **Rate limiter:** a serialized queue enforcing a **minimum 7.5 s spacing** between requests → ≤ 8 req/min (margin under the 10/min cap). Additionally:
  - read `x-requests-available-minute` from each response; if it hits 0, pause until the minute window resets.
  - on HTTP 429, honor `Retry-After` and re-queue.
- **Typed fetchers:** `getCompetition()`, `getTeams()`, `getMatches({status?, dateFrom?, dateTo?, stage?})`, `getScorers()`, `getMatch(id)`. (`getStandings()` defined but unused per D4 — omit until needed.)
- **Mappers (pure, unit-tested):**
  - `mapStatus`: `SCHEDULED|TIMED → SCHEDULED`; `IN_PLAY|PAUSED → LIVE`; `FINISHED|AWARDED → FINISHED`; `POSTPONED → POSTPONED`; `CANCELLED|SUSPENDED → CANCELLED`.
  - `mapStage`: `GROUP_STAGE→GROUP, LAST_32→R32, LAST_16→R16, QUARTER_FINALS→QF, SEMI_FINALS→SF, THIRD_PLACE→THIRD, FINAL→FINAL`.
  - `mapGroup`: `"GROUP_A" → "A"` (→ `Group.name`).
  - `mapScore`: `score.fullTime.{home,away}` → `scoreHome90/Away90`; `score.winner` (`HOME_TEAM/AWAY_TEAM/DRAW`) → `result90` (`HOME/AWAY/DRAW`).
- **Testability:** the raw `fetch` is injectable (mirrors the existing `FetchJson` pattern in `ingest.ts`) so mappers + sync logic are tested against captured JSON fixtures, no network.

### 3.2 Sync functions — `packages/pipeline/src/football-data.ts`

- `syncTeamsAndSquads(prisma, client)` — `getTeams()` (1 call). For each FD team: resolve DB team by `externalId` else by `code`/`tla` (name fallback), set `externalId`, update `manager` (coach name) and `flagUrl`/`code` if missing. **Replace that team's squad** with the FD `squad[]` (real names): delete existing players for the team, insert FD players keyed by `externalId` (FD player id), coarse `position` mapped to GK/DEF/MID/FWD. Safe because nothing references `Player.id` (micro/lineup are regenerated; `microPrediction: 0`).
- `syncMatches(prisma, client)` — `getMatches()` (1 call). For each FD match: resolve home/away DB teams via `Team.externalId`; on first sync find the DB match by `(homeTeamId, awayTeamId, round)` and set `Match.externalId`; thereafter upsert by `externalId`. Update `kickoffAt, status, round, groupId, scoreHome90/Away90, result90`. Do **not** touch `venueId` (D5) or odds (D6).
- `syncLiveScores(prisma, client)` — `getMatches({status: 'LIVE'})` (1 call) → update score/status for live matches; publish the existing `match.update` realtime event. Replaces the worldcup26 `/get/games` poll.
- `syncScorers(prisma, client)` — `getScorers()` (1 call) → upsert `Scorer` rows (P4 only).

### 3.3 Worker wiring — reuse existing scaffolding (`apps/worker`)

NestJS + BullMQ already exists. No new infra.
- **Reference sync:** extend/replace the worldcup26 ingest path. New job key `fd_sync` (or reuse an existing scheduler hook) registered in `ScheduleJob` + `JobKey` union (`packages/pipeline/src/job-config.ts`). Runs `syncMatches` + `syncScorers` each cycle (2 calls); `syncTeamsAndSquads` on a slower sub-cadence (squads rarely change). Cadence config-driven via `getJobConfig`.
- **Live:** rewire `LiveScoreWorker` (`livescore/livescore.worker.ts`) to call `syncLiveScores` instead of worldcup26; only active while ≥1 match is LIVE.
- **Result check / settlement:** reuse `ResultCheckWorker` + `SettlementWorker` unchanged in shape; they read FINISHED status from DB which `syncMatches`/`syncLiveScores` now populate from FD.
- The old worldcup26 `ingest.ts` / `livescore.ts` functions become dead once rewired. Per house rules they are **flagged, not deleted** here (removal is a separate, explicit task).

### 3.4 Budget

| Source | Calls | Cadence | req/min |
|---|---|---|---|
| `syncMatches` + `syncScorers` | 2 | every 30–60 min (tournament window) | ≤ 0.07 |
| `syncTeamsAndSquads` | 1 | daily / manual | negligible |
| `syncLiveScores` | 1 | ~60 s, only while live | ≤ 1 |
| `/matches/{id}` (user opens match) | 1 | on demand | bursty, serialized |

Worst case stays well under the 8/min ceiling; the serialized client guarantees it even under burst.

---

## 4. Field → DB → UI mapping

| football-data | DB | UI surface |
|---|---|---|
| `team.id` | `Team.externalId` | — |
| `team.tla` / `name` / `crest` | `Team.code` / `name` / `flagUrl` | team list/detail |
| `team.coach.name` | `Team.manager` | team detail |
| `team.squad[].{id,name,position}` | `Player.{externalId,name,position}` | squad list (real names) |
| `match.id` | `Match.externalId` | — |
| `match.utcDate` | `Match.kickoffAt` | **kickoff time** |
| `match.status` | `Match.status` (mapped) | **live badge / status** |
| `match.stage` | `Match.round` (mapped) | **round/stage label** |
| `match.group` | `Match.groupId` (via `Group.name`) | group |
| `match.score.fullTime` | `Match.scoreHome90/Away90` | **score** |
| `match.score.winner` | `Match.result90` | result |
| *(null)* | `Match.venueId` (existing, untouched) | venue (from DB) |
| `scorers[].{player,team,goals,assists,penalties}` | **new `Scorer`** | **Top Scorers page (P4)** |

UI enhancements (P2) — kickoff time, stage/round, score — flow through DB → existing `/api/v1/*` routes → existing screens with render-only additions. No new web data plumbing except the P4 scorers route/page.

---

## 5. Feature proposals from the API

1. **Top Scorers / Golden Boot page** (`/scorers`) — **APPROVED (D2)**. New `Scorer` table (fields: `externalId` = FD player id, `playerId?` → DB `Player`, `teamId`, `name`, `goals`, `assists`, `penalties`; ranked by goals at read time), a `/api/v1/scorers` route, and a leaderboard screen. Strong fit: a canonical WC view that complements the prediction game. Empty until play begins.
2. **Rich match detail on open** (`/matches/{id}`) — folded into D3. When a user opens a live/finished match, fetch once for `minute`, goals timeline, lineups, bookings. No new model (transient render); optional light caching later. Secondary.
3. *(Not pursued)* API-authoritative standings (`/standings`) — rejected as default (D4); revisit only if computed tiebreakers prove wrong in practice.

---

## 6. Phases & gates

- **P1 — Client + scheduled sync + cache.** Build `football-data.ts` (client + rate limiter + mappers + sync fns) with unit tests on captured JSON; **migration** adding `externalId` to Team/Match/Player (D1 gate — user approves migration + confirms `SPORTS_API_KEY`/`SPORTS_API_BASE_URL` populated). Wire reference sync + live sync into the worker. *Done when:* running the job populates teams/squads/matches from real FD data; rate limiter provably caps at ≤8/min.
- **P2 — De-mock + enhance UI.** Web reads real data (already DB-backed); add render-only kickoff time / stage / score / real squads. *Done when:* no synthetic team/player/match data shown; new fields render.
- **P3 — Live status workflow.** `syncLiveScores` via `?status=LIVE`; stop polling once FINISHED; don't poll far-future SCHEDULED. *Done when:* live matches update by status, finished/far matches aren't polled.
- **P4 — Top Scorers.** `Scorer` **migration** (D2 gate) + sync + route + page. *Done when:* the page renders real scorers once data exists.

**Stop-and-ask before:** any `.env` change, any new dependency, any schema migration (P1 + P4), any file deletion (show diff first), or building anything not approved here.

**Cadence:** one phase per run; print a per-file summary and stop for review at each phase boundary.

---

## 7. Security note

The verification key was supplied in chat and used transiently only (never written to `.env`, repo, or any file). Recommend rotating it on football-data.org before production use, then setting the fresh key in `.env` (`SPORTS_API_KEY`).
