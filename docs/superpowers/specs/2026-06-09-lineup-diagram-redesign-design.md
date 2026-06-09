# Lineup Diagram Redesign — Design

**Date:** 2026-06-09
**Goal:** Replace the match/team lineup rendering so it is **always a pitch diagram** (reference: Uniscore-style vertical pitch), never a flat list. Real lineup → real formation diagram + substitutes. No real starting XI → a common **4-3-3** diagram from the squad + substitutes.

**Scope:** `apps/web/components/formation-pitch.tsx` only. All call sites (match detail — both teams; team detail; admin match/team detail) already pass `players / formation / manager` — no call-site changes. Frontend/render only; no API/DB/logic-elsewhere change.

---

## Background

`FormationPitch({ players, formation, manager })` receives `LineupPlayer[]` = `{ name; position: string|null; number: number|null; starter?: boolean }`.
- **AI lineup** data (per-match crawl, near kickoff): specific positions (RB/CB/CAM/ST…), shirt numbers, `starter` flags on 11, `Team.formation` (e.g. `4-2-3-1`).
- **football-data squad** data (baseline): coarse positions only (`GK/DEF/MID/FWD`), **no shirt numbers**, **no `starter` flags** (all false), no formation.

Current behavior: real XI → pitch (5 bands) + bench; no XI → flat grouped-roster **list**. The list is the thing being replaced.

---

## Decisions (approved 2026-06-09)

| # | Decision | Choice |
|---|---|---|
| D1 | No-XI default formation | **Always 4-3-3** (ignore any stale `Team.formation`). |
| D2 | No-XI XI selection when a line is short | **Show fewer, never fabricate** — place up to 1/4/3/3 by position bucket; a short bucket yields a shorter pitch line; everyone not placed → substitutes. |
| D3 | Polish | **Polish toward the reference** for BOTH cases: header strip (formation badge + manager) + clean vertical pitch + tidy chips + substitutes list. Replaces the flat list. |

---

## Architecture

### Pure helper `deriveLineup(players, formation)` (exported, unit-tested)

Returns `{ lines: LineupPlayer[][]; subs: LineupPlayer[]; formationLabel: string }` where `lines` is ordered **top→bottom (attack→goal)** for direct pitch rendering.

- **Real XI** — `players.some(p => p.starter)`:
  - `starters = players.filter(p => p.starter)`, `subs = players.filter(p => !p.starter)`.
  - `lines` = the existing 5 bands `[FWD, AM, DM, DEF, GK]` filtered to non-empty, each sorted left→right by `sideRank` (honors specific positions). Reuses current `bandOf` + `sideRank`.
  - `formationLabel` = `formation ?? ''` (the real stored formation).
- **No XI** — otherwise (FD roster):
  - Bucket all players by coarse band via `bandOf` → `GK`, `DEF`, `MID`(=DM band), `FWD`.
  - Take the first **1 GK / 4 DEF / 3 MID / 3 FWD** (in roster order) → these are the pitch 11.
  - `lines` = `[FWD(≤3), MID(≤3), DEF(≤4), GK(≤1)]`, non-empty only.
  - `subs` = every player not selected for the pitch (full-bucket overflow + all other lines' leftovers), preserving roster order.
  - `formationLabel` = `'4-3-3'`.
- Edge: empty `players` → `lines: []`, `subs: []`, `formationLabel: ''` → component renders an empty-state line.

> The two cases differ only in how `lines` is built; the render path is shared.

### Render (shared shell, polished toward reference)

1. **Header strip** (when `manager` or `formationLabel`): manager (user icon + name) on the left, formation badge (`badge-sky`) on the right. Formation badge now shows in BOTH cases (real or `4-3-3`).
2. **Pitch**: keep the current vertical pitch (aspect `3/4`, max-width, SVG markings, green stripes). Render each `lines` row as a `row` of `Chip`s spaced `space-around`.
3. **Chip**: number circle — `p.number` when present, else the **position abbrev** (so FD-no-number players aren't blank circles) — + name + position label. (Existing `Chip` adjusted to fall back to position in the circle.)
4. **Substitutes**: below the pitch, the existing card-grid (`grid-fill`, `--col-min:170px`) of `subs` (number/name/position), labelled `t('tournament.bench')` (reuse existing key — no new i18n).

### Removed
`RosterGroup` + `BAND_LABELS` (the flat-list fallback) are deleted — replaced by the no-XI 4-3-3 pitch.

---

## Testing

- New unit test `formation-pitch.test.tsx` (vitest, jsdom) for the **pure `deriveLineup`** only:
  - real XI (some `starter`) → `lines` are the band split of starters, `subs` = non-starters, `formationLabel` = passed formation.
  - no XI, full roster (≥1 GK, ≥4 DEF, ≥3 MID, ≥3 FWD) → pitch = exactly 1/4/3/3, `formationLabel` = `'4-3-3'`, `subs` = the rest (count = total − 11).
  - no XI, short forwards (e.g. 2 FWD) → FWD line has 2, no fabrication, subs excludes the placed players.
  - empty `players` → empty lines/subs.
- Render stays visual/manual (jsdom has no layout engine). Existing web suite must stay green (the 1 pre-existing `Flag` failure is unrelated).

**Verification gate:** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (prior 121 pass + the new deriveLineup tests; the 1 pre-existing `Flag` fail stays).

---

## Out of scope / non-goals
- No team-color jerseys / crest on chips (reference shows them; deferred — current chip gradient is fine).
- No change to how lineups are *sourced* (AI crawl vs FD) — only how they're *rendered*.
- No new i18n keys (reuse `tournament.bench`); `'4-3-3'` is a literal.
