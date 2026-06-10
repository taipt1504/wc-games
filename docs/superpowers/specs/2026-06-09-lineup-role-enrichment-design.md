# Lineup Role Enrichment — Design

**Date:** 2026-06-09
**Goal:** Make the lineup diagram role-accurate. The data flow is explicit: **football-data.org `/v4/competitions/WC/teams` → the team's real player roster → fed into the LLM prompt → model returns the team's best projected XI** (specific positions, the 11 starters, formation, shirt numbers) → mapped back onto the team's player rows. The diagram's existing render then places everyone correctly.

**Roster source (important):** the roster fed to the LLM is the team's **football-data-sourced `Player` rows** — the rows `syncTeamsAndSquads`/`syncOneTeamSquadFromFd` wrote from `api.football-data.org` (they carry `Player.externalId`). So the squad in the prompt is the official FD player list, not LLM-invented and not the synthetic seed. **Prerequisite:** the team's FD squad must already be synced (admin "Sync squad (API)" / `ingest:fd`); enrichment only annotates that roster. The two-step chain is **Sync squad (API)** [FD fetch] → **Assign roles & XI (AI)** [LLM enrich].

**Scope:** `packages/pipeline` (enrichment), `apps/worker` (bulk job), `apps/web` (admin route + buttons; `formation-pitch.tsx` projected label). Does NOT change the FD roster source or the pitch placement logic.

---

## Problem & root cause

Players in the DB currently carry only **coarse** positions (`GK/DEF/MID/FWD`), `isStarter=false` for everyone, and no shirt numbers — because the P4 FD squad sync (`syncTeamsAndSquads`) is the roster source and FD's `/teams` squad has no specific role, no starting XI, no numbers. Consequences seen by the user:
- A striker (Lukaku, coarse `FWD`) lands on a wing — the 4-3-3 fallback lays the first N forwards in a row with no ST/RW/LW distinction.
- Substitutes appear in the XI — "first-N per coarse bucket" is roster order, not the real starters.

The render is **not** at fault: `bandOf`/`sideRank` already place *specific* roles correctly (ST→centre-forward, RW→right, CB→centre-back). This is a **data** gap. Only an LLM can supply specific roles + a likely XI from a roster. (Approved approach A.)

---

## Decisions (approved 2026-06-09)

| # | Decision | Choice |
|---|---|---|
| D1 | Source of roles + XI | **AI-enrich the real FD roster** — LLM annotates the *existing official players*; never replaces the roster. |
| D2 | Trigger | **Per-team admin button (sync) + bulk admin button (async worker job) + CLI** for the 48-team one-shot. |
| D3 | Fallback (un-enriched / no XI) | Keep the default **4-3-3** pitch, badge labelled **"· projected"** so an estimate is visibly distinct from a confirmed XI. |

---

## Architecture

### 1. Enrichment — `packages/pipeline/src/squad.ts`

- **`enrichLineup(gateway, { name, players: string[], model? }): Promise<CrawledLineup>`**
  - The team's **real roster names** (from the FD-synced `Player` rows) are passed into the prompt.
  - Prompt instructs the model to return, for the given team, its **best/strongest projected XI**: for EACH supplied name a specific `position` (`GK/RB/CB/LB/RWB/LWB/CDM/CM/CAM/RM/LM/RW/LW/ST/CF`), `number`, and `starter` — **exactly 11 `starter:true`** forming a realistic `formation` — plus `manager`. Must reuse the **exact supplied names**.
  - Reuses the existing `CrawledLineup` shape + `parseLineupJson` (already tolerant of fences/dupes/bad rows).
  - Differs from the existing `crawlLineup` only in that the roster is an **input** (annotate given names) rather than the model inventing the roster.

- **`enrichAndStoreLineup(prisma, gateway, teamId): Promise<{ team; matched; starters; status }>`**
  - Load the team + its players (the FD-synced roster). If the team has **no players** → return `status: 'no-roster'` without an LLM call (caller surfaces "run Sync squad (API) first").
  - `enrichLineup(gateway, { name, players: existingNames })` — the FD roster names go into the prompt.
  - In a transaction: reset the team's players to `isStarter:false`; for each assignment, find the team's `Player` by **normalized name** (lowercased, diacritics stripped, punctuation/space-collapsed) and update `position` (specific), `isStarter`, `number`; set `Team.formation`+`manager`.
  - **No player rows added or removed** — FD's official roster is preserved; an LLM name with no match is skipped; a roster player the LLM omits stays `isStarter:false` (a substitute).
  - Log an `AiJob` (type `squad`), like `crawlAndStoreSquads`. A failed/empty crawl leaves the team untouched.

- **`enrichAllLineups(prisma, gateway): Promise<…[]>`** — loop all teams, `enrichAndStoreLineup` each, collect summaries.

### 2. Triggers

- **Per-team:** `POST /api/v1/admin/teams/[id]/enrich-lineup` → `enrichAndStoreLineup`. Admin-guarded; constructs the `LlmGateway` from env exactly as the existing `…/recrawl` route does; if the gateway is unconfigured, return `503 { error: { code: 'LLM_NOT_CONFIGURED' } }`. Writes an `AuditLog` (`ENRICH_LINEUP`, `target: team:<id>`). Admin UI button **"Assign roles & XI (AI)"** in team detail (next to the existing FD/AI squad buttons).
- **Bulk (async):** new worker job key `enrich_lineups` in `job-config.ts` + a worker runner that calls `enrichAllLineups`, wired into `ControlWorker`. Admin **"Assign roles & XI — all teams"** button fires it via the existing `POST /api/v1/admin/schedule-jobs/enrich_lineups/trigger` (Redis pub/sub → worker) — non-blocking (48 sequential LLM calls must not run inside a request).
- **CLI:** `packages/pipeline/src/enrich-lineups-cli.ts` + script `enrich-lineups` (`dotenv -e ../../.env -- tsx src/enrich-lineups-cli.ts`) → `enrichAllLineups` for ops one-shot.

### 3. Render — `apps/web/components/formation-pitch.tsx`

- `deriveLineup` returns an added **`projected: boolean`** — `false` when a real starting XI exists (`some(p.starter)`), `true` on the 4-3-3 fallback.
- Header badge: real XI → `formationLabel` as-is; projected → `formationLabel` + the projected tag, e.g. `4-3-3 · {t('tournament.projected')}`.
- New i18n key `tournament.projected` (EN `'projected'`, VI `'tạm tính'`) in both dictionaries.
- **No change** to `bandOf`/`sideRank`/line layout — once players carry specific positions + `isStarter`, the existing real-XI path renders accurately.

### 4. Dependencies & guards

- Needs the **LLM gateway** (`LLM_GATEWAY_BASE_URL`/`LLM_GATEWAY_API_KEY`). Like the FD key, it's a runtime dependency: routes/worker guard and degrade (record `SKIPPED`/return 503) when unconfigured; the diagram falls back to the labelled 4-3-3.
- Name matching: exact then diacritic-normalized; unmatched LLM names skipped (never create players). A re-run is idempotent (starters reset first).

---

## Testing

- **Pure unit tests (vitest):**
  - The assignment→roster mapper (a pure helper `applyLineupAssignments(players, assignments)` returning the updated rows): normalized name match (`"Romelu Lukaku"` ↔ `"romelu lukaku"`; accents), exactly the matched 11 get `starter:true`, omitted roster players stay `starter:false`, unmatched assignment names ignored.
  - `parseLineupJson` already tested-by-reuse; add a case for the enrich prompt's echo shape if shape differs.
  - `deriveLineup` gains a `projected` assertion (real-XI → false; no-XI → true).
- DB-store fns (`enrichAndStoreLineup`/`enrichAllLineups`) and routes are build-verified (DB/LLM-impure), consistent with the other sync/crawl functions.
- **Verification gate:** `pnpm --filter @wc/pipeline build` + `pnpm --filter @wc/pipeline test` (pipeline) and `pnpm --filter @wc/web exec tsc --noEmit` + `pnpm --filter @wc/web test` (web: prior pass count + new tests; the pre-existing `Flag` fail stays). Live enrichment verified by running the CLI once the LLM gateway is reachable.

---

## Out of scope / non-goals
- Not changing the FD roster source (FD remains the squad/names source; this only annotates roles + XI on top).
- Not changing pitch placement logic (`bandOf`/`sideRank` unchanged).
- The XI is a model **projection**, not an official team sheet — hence the "projected" label. Near a real kickoff, the existing per-match lineup worker can still refine it.
