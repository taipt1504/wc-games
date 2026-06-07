# Phase 2 enhancements — Squad pitch + Admin team management — Design

> Date: 2026-06-07 · Status: Approved (design) · Scope: `apps/web`, `packages/pipeline`/`@wc/ai` (reuse only)
> From review of Phase 2. Two independent, low-risk enhancements.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Squad layout | **4-band pitch** (GK/DEF/MID/FWD) — data has only position groups, no tactical slots |
| 2 | Admin-editable team fields | **name, code, flagUrl** (not group/rank) |
| 3 | AI re-crawl | **per-team, synchronous** (~11s) |

## A. Squad pitch (TeamDetail)

Replace the current grouped list in `TeamDetail`'s SQUAD section with a `SquadPitch` component (`screens-tournament.tsx`).

- Vertical football pitch (reuse `LineupsPanel`'s green gradient + SVG markings styling).
- **4 horizontal bands**, top→bottom: **FWD · MID · DEF · GK**. Each position group's players spread evenly (`space-around`) across its band as a numbered dot + name label. Counts vary per line (no fixed formation).
- Keep the **AI-assisted** badge. Empty `players` → "Squad coming soon" (unchanged).
- Honest to the data: only GK/DEF/MID/FWD groups exist; no invented tactical positions.

## B. Admin team management

**APIs** (new, `requireAdmin` + `auditLog`):
- `PATCH /api/v1/admin/teams/[id]` — body `{ name?, code?, flagUrl? }` (zod; only provided fields updated) → `Team.update` → audit `EDIT_TEAM`. 403 non-admin, 404 missing.
- `POST /api/v1/admin/teams/[id]/recrawl` — `createGatewayFromEnv`; 503 if absent. Reuse `crawlAndStoreSquads(prisma, gw, [{id,name}])` (crawl → replace that team's players → AiJob). Returns `{ count }`. audit `RECRAWL_SQUAD`.
- `GET /api/v1/teams` — add `playerCount` (prisma `_count.players`) for the admin list's real squad badge.

**Admin UI** (`screens-admin.tsx`):
- **De-mock `AdmTeams`**: fetch `/api/v1/teams` (48 real, flag/group/code, real `playerCount`); replace `WC.teams` slice + fake "26 ✓". Real KPIs (teams/groups counts from data).
- **Rewrite `AdmTeamDetail`** (the `open('team')` surface): fetch `/api/v1/teams/[id]`; header (flag/name/group, no rank/conf); **edit form** (name/code/flagUrl) → **Save** (PATCH, toast + refresh); **Re-crawl squad (AI)** button (loading ~11s, POST recrawl, toast `${count} players`, refresh); current squad list. Remove `WC.byId`/`t.colors`/fake squad.

## Testing
- API: route handlers compile + logic (admin guard, field update, recrawl gateway-absent → 503).
- Components: `SquadPitch` renders bands from players; `AdmTeams`/`AdmTeamDetail` render with mocked fetch (existing admin tests stay green).
- Manual: edit a team + re-crawl one squad live; view squad pitch.

## Stop-conditions
None — no new dependency, no migration; LLM gateway already configured. Reuses `crawlSquad`/`crawlAndStoreSquads`.

## Notes
- `AdmTourney` still uses `WC.matches` mock (Phase 4/5) — out of scope here.
- `playerCount` on the public `/teams` route is harmless (squad size is public info).
