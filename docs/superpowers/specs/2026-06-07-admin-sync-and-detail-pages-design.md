# Design: Admin Manual-Sync + Richer Match Detail Pages

**Date:** 2026-06-07
**Status:** Approved (design) — pending spec review → writing-plans

## Goal

Two related improvements to wc-game:

1. **Admin manual-sync** — on-demand, admin-triggered actions to pull/refresh a match's **odds**, **lineup**, and **result** from trusted real data, each writing real data with a `source` label + audit entry.
2. **Richer match detail pages** — make the user and admin match-detail pages more detailed and complete (real lineups, bet exposure, audit), removing the remaining stubs.

Both improvements share the **admin match-detail page** as their hub, and both consume the AI-crawled lineup via the existing `FormationPitch` component.

## Data-source reality (constraint)

| Data | Real source today | Sync path in this design |
|------|-------------------|--------------------------|
| **Result** (score/status) | ✅ worldcup26.ir feed (`/get/games`) | One-click sync from the feed — real, no key. |
| **Odds** | ❌ synthetic `houseOdds()` | No real feed → **admin manual editor** (curated) + optional AI-propose draft. |
| **Lineups** | ❌ AI-generated (LLM) | No real feed → **AI-crawl on-demand** + admin manual override. |

Genuinely-external odds/lineup feeds (The Odds API, API-Football) require a **paid provider + API key**. **Decision: do not require keys now.** Use feed-results + AI/manual odds & lineups; build sync routes so a real provider adapter can slot in later behind the same buttons.

## Decisions (locked)

- **Data sourcing:** Hybrid now, pluggable later (no new external deps/keys).
- **Scope:** One spec, two implementation phases — **Phase A** (admin-sync + richer admin detail) first, **Phase B** (richer user detail) second.
- **No schema change.** Reuse `Player.isStarter`/`Team.formation`, `MatchOdds`, `AuditLog`, 90'-basis settlement.

---

## Phase A — Admin manual-sync + richer admin detail

All routes are `requireAdmin`-gated (403 otherwise), validate input (422), and write an `AuditLog` row targeting `match:${id}`.

### A1. Sync result from feed
- **Route:** `POST /api/v1/admin/matches/:id/sync-result`
- **Logic:** add `syncOneMatchResult(prisma, matchId, fetchJson?)` to `packages/pipeline/src/livescore.ts` — fetch `/get/games`, find this match's game, apply the existing `liveScoreUpdate` mapper, write `status`/`scoreHome90`/`scoreAway90`/`result90` + `source='API'`. Returns the updated match.
- **Does NOT settle** — settlement stays the existing admin **Confirm/Re-settle** action (resettle route). Audit action `SYNC_RESULT`.
- **Note:** this is admin explicitly pulling feed data, so it sets `source='API'` (the live poller may then keep it fresh). If the admin wants an authoritative manual result, they use Confirm/Re-settle (which sets `source='ADMIN'`).

### A2. Odds — manual editor (+ optional AI-propose)
- **Route:** `POST /api/v1/admin/matches/:id/odds` `{ mHome, mDraw, mAway, reason }` → upsert `MatchOdds` with `source='ADMIN'` + audit `EDIT_ODDS`. Existing open bets keep their `oddsSnapshot`.
- **UI:** restore the `OddsEditModal` (removed earlier), now backed by this real route; shows implied book margin.
- **Optional (stretch, can defer):** `POST /api/v1/admin/matches/:id/odds/propose` → LLM suggests a 1/X/2 line (grounded on team strength) → returns a **draft** the admin edits before saving. Labeled AI-assisted. Not required for Phase A to ship.

### A3. Lineup — AI sync (+ manual override)
- **Route:** `POST /api/v1/admin/matches/:id/sync-lineup` → reuse `createGatewayFromEnv(@wc/ai)` + `refreshMatchLineups(prisma, gw, matchId)` (already added to `@wc/pipeline`) — AI-crawls both teams' XI server-side, updates `Player.isStarter`/`Team.formation`. Mirrors the existing `admin/teams/[id]/recrawl` route. Audit `SYNC_LINEUP`. Returns per-team `{count, starters, status}`; `503` if no gateway, `502` if the crawl fails.
- **Manual override:** admin can correct a team's XI via the existing team-squad management (AdmTeamDetail). A dedicated per-match lineup editor is out of scope for Phase A (note as future).

### A4. Bet-exposure panel (real)
- **Route:** `GET /api/v1/admin/matches/:id/bets` → aggregate `Prediction` rows (`market='1X2'`) for the match, grouped by `outcome`: `{ outcome, count, stakedVolume, potentialPayout = Σ stake×(1+oddsSnapshot) }`, plus totals and settlement status. Includes GLOBAL + LOBBY contexts (labeled).
- **UI:** replaces the previously-fabricated "bet distribution" card with real numbers (count, staked volume, potential liability per outcome).

### A5. Audit trail (real)
- **Route:** `GET /api/v1/admin/matches/:id/audit` → recent `AuditLog` rows where `target='match:${id}'`, newest first, capped (e.g. 20).
- **UI:** a compact list (action · actor · time · metadata) on the admin detail page.

### A6. Admin detail UI (`AdmMatchDetail`)
Sections, top to bottom:
1. Hero (existing real data).
2. **Data sync panel:** `[Sync result ⟳]` · `[Edit odds ✎]` (+ AI-propose if built) · `[Sync lineup ⟳]`. Each shows last `source` + outcome toast.
3. **Bet exposure** (A4) — per-outcome count/volume/liability + settled status.
4. **Lineups** — `FormationPitch` for both teams (what users see).
5. **Match actions** (existing) — lock/unlock betting, Confirm/Re-settle result.
6. **Audit trail** (A5).

---

## Phase B — Richer user detail (`MatchDetail` in `screens-match.tsx`)

- **Lineups tab → real:** fetch both teams via `GET /api/v1/teams/:homeId` + `/:awayId` (returns `players: {name,position,number,starter}`), render `FormationPitch` per team. Labeled **AI-predicted**. Replaces the current "coming soon" stub.
- **Drop Form / H2H tabs** — no real source; no fabrication. Tabs become **AI Pundit** + **Lineups**.
- **Enrich hero:** show venue city/country + round/group context (data already in `/matches/:id`).
- Keep existing: odds + bet slip, my-bets (WON/LOST), live micro-bet, AI Pundit (real `/ai/preview`).

---

## Pluggability (future, not built now)

A `SyncProvider`-style seam behind the sync routes:
- `sync-result` already real (worldcup26.ir).
- Future: add `TheOddsApi` (odds) / `ApiFootball` (lineups, ~40min pre-match) adapters behind the same `odds` / `sync-lineup` routes once API keys are provisioned. Documented; not implemented.

## Error handling

- Admin routes: `requireAdmin` → 403; bad body → 422; missing match/team → 404; feed/LLM failure → graceful (`502/503` + toast), no crash. AI lineup crawl already error-tolerant (per-team status, teams untouched on failure).
- UI: every sync action toasts success/failure and reloads the match; no optimistic local-only state (avoids the earlier "looks done but reverts" class of bug).

## Testing

- **Unit (pipeline, no DB):** `syncOneMatchResult` with a fake feed (updates the right match; skips unknown ids).
- **Unit (web, fake prisma):** bet-exposure aggregation math; odds-route validation.
- **Component (jsdom):** admin detail renders the sync panel + exposure + audit; user detail Lineups tab renders `FormationPitch` from mocked `/teams/:id`.
- All existing tests stay green.

## Out of scope

- Real paid odds/lineup API integration (deferred until keys are provisioned).
- Per-match lineup history table (reuse team-level `Player`).
- ET/penalty settlement (90' basis unchanged).
- Per-match manual lineup editor UI (manual override via existing team-squad management).
