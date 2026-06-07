# Formation lineup pitch (squad) — Design

> Date: 2026-06-07 · Status: Approved (design) · Scope: `packages/db` (migration), `packages/pipeline`, `apps/web`
> From UI review (Image #2 reference). Replaces the 4-band squad pitch with a real formation lineup.

## Decisions (locked)
| # | Decision | Choice |
|---|---|---|
| 1 | Fidelity | **Full lineup** — real formation + starting XI + specific positions + manager (migration approved) |
| 2 | Highlight | **Visual polish** (jersey chips, bold names, position labels) — no key-player flag |
| 3 | Layout | **XI in formation + bench + manager** (Image #2) |
| 4 | Surfaces | Both user `TeamDetail` and admin `AdmTeamDetail` (shared component) |

## 1. Migration (approved — additive, nullable)
`packages/db/prisma/schema.prisma`:
- `Team.formation String?` (e.g. "4-2-3-1")
- `Team.manager String?`
- `Player.isStarter Boolean @default(false)`
- `Player.position` now holds the **specific** role (GK/RB/CB/LB/RWB/LWB/CDM/CM/CAM/RM/LM/RW/LW/ST/CF/…). Existing rows hold group values until re-crawled.

Apply with `prisma migrate dev --name add_lineup_fields` (regenerates client). **Drift guard:** check `migrate status` first; if the dev DB would require a reset, STOP (no data loss) and report. Committed baseline migration untouched.

## 2. AI crawl — enrich (`packages/pipeline/src/squad.ts`)
`crawlSquad` returns a lineup object:
```
{ manager: string, formation: string, players: [{ number, name, position(specific), starter: boolean }] }  // ~23, exactly 11 starter:true
```
- Parser: validate name + position (non-empty) + starter bool; ~11 starters; tolerate fences/wrapper.
- `crawlAndStoreSquads` → per team: replace Player rows (position=specific, isStarter) + set `Team.formation`/`Team.manager` + AiJob.
- Re-crawl all 48 (background, ~10 min). Admin per-team re-crawl uses the same path.

## 3. Render — `FormationPitch` (new, shared)
- Manager box (top). **5 bands** top→bottom: **FWD · AM · DM · DEF · GK**.
- Starter → band by specific position (mapping table: GK→GK; RB/CB/LB/RWB/LWB/WB/DF→DEF; CDM/DM/CM→DM; CAM/AM/RM/LM/RW/LW/RF/LF→AM; ST/CF/FW/SS→FWD). Horizontal spread by side prefix (R→right, L→left, else center), then index.
- Player chip: jersey-number circle + surname + small position label. Visual polish.
- **Bench** (isStarter=false) listed below (number · name · position).
- **Fallback**: no starters / no formation (not yet re-crawled) → render all players grouped into the 4 broad bands (current behaviour) so nothing breaks mid-migration.
- Used by `TeamDetail` (replaces `SquadPitch`) and `AdmTeamDetail` (replaces the plain squad list).

## 4. API
`GET /api/v1/teams/:id` → add `formation`, `manager`; players include `position` (specific) + `isStarter`. `GET /api/v1/teams` unchanged (+ existing `playerCount`).

## 5. Testing
- Migration applies; client regenerated.
- Parser unit test (formation/manager/starters/specific positions; ~11 starters; bad rows dropped).
- `FormationPitch`: renders XI in bands + bench + manager from data; fallback renders group bands when no starters.
- Existing suites green (web/ai/pipeline). Manual: re-crawl one team, view both portals.

## Stop-conditions
Migration approved (decision 1). No new dependency. Gateway configured. ~48 LLM re-crawls (cost accepted).

## Notes
- Position→band mapping is deterministic + tolerant of unknown strings (unknown → nearest band by heuristic, else bench-style).
- Fallback path keeps the app correct between migration and the full re-crawl completing.
