# Leaderboard Consistency — Design

**Date:** 2026-06-09
**Goal:** Fix two leaderboard defects. (1) The Home summary leaderboard renders negative ROI as `+-6.5%` (and the Home ROI stat does too) — make ROI formatting sign-safe and shared. (2) The lobby leaderboard ranks by absolute points, not ROI — rank it by a lobby ROI (bankroll growth vs the lobby seed), presented as the **same concept** as the global ROI.

**Scope:** `apps/web` (a new shared formatter + 3 render sites + lobby board), `apps/web/app/api/v1/lobbies/[id]/route.ts` (add `roi` + sort). No DB/schema change, no new deps.

---

## Findings (from investigation)

- **Global leaderboard** (`/api/v1/leaderboard` → `getGlobalLeaderboard`): ranks by `netProfit` desc (tie-break `roi`); the route returns `roi = round(netProfit / SIGNUP_BONUS * 1000)/10` = **bankroll-growth %** (e.g. `24.1`). Render uses `sgnPct(n) = `${n>=0?'+':''}${n}%`` (sign-safe). ✓
- **Home summary** (`MiniBoard` + Home ROI stat, `screens-core.tsx`): fetches the **same** `/api/v1/leaderboard` — data is identical to the full page. Bug is **formatting only**: 3 sites hardcode `+{roi}%` (`screens-core.tsx:292, 435, 441`) → negative → `+-6.5%`. (This card is on the **authed Home**, not the guest Landing.)
- **Lobby board** (`LobbyBoard` ← `GET /api/v1/lobbies/[id]`): per member `{ def, won, borrowed, score }` where `score = lobbyScore(winnings, defaultPoints, borrowed) = winnings + defaultPoints − borrowed`. Sorted by `score` desc (`route.ts:69-70`). **No ROI column, no ROI sort.** Lobby has its own wallet (seed `defaultPoints` + borrowing), separate from the global one.

---

## Decisions (approved 2026-06-09)

| # | Decision | Choice |
|---|---|---|
| D1 | ROI formatting | **One shared sign-safe formatter** used at all ROI/percent sites. `+24.1%`, `-6.5%`, `0%`. |
| D2 | Lobby ranking | Rank by **lobby ROI = (winnings − borrowed) / defaultPoints**, shown as a %; tie-break by `score`. |
| D3 | ROI concept | **Same concept, different base**: ROI = `netProfit / starting-bankroll`. Global base = `SIGNUP_BONUS` (1000); lobby base = that member's `defaultPoints`. One formatter, consistent sign + 1-decimal precision. |

---

## Architecture

### 1. Shared formatter — `apps/web/lib/format.ts` (new)

```ts
/** Signed percent for ROI/growth display. +24.1% · -6.5% · 0% (no "+-" double sign). */
export function pctSigned(n: number): string {
  const r = Math.round(n * 10) / 10;        // 1-decimal, consistent with the API's rounding
  return `${r > 0 ? '+' : ''}${r}%`;          // negative keeps its own '-'; zero → '0%'
}
```
- `r > 0` (not `>= 0`) so zero renders `0%` (not `+0%`). Negative numbers already carry `-`.
- One unit, pure, trivially testable.

### 2. Wire the formatter at every ROI site

- `apps/web/components/screens-core.tsx`: replace the 3 hardcoded `+{roi}%` (Home ROI stat `:292`, MiniBoard row `:435`, You row `:441`) with `pctSigned(...)`. Fixes `+-6.5%` and `+0%`.
- `apps/web/components/screens-compete.tsx`: replace the local `sgnPct` (line 10) with `pctSigned` from the lib (the 5 call sites already pass the roi number) — one formatter across the app, no duplication. (`sgnNum`/`sgnCol` stay local — different concern.)

### 3. Lobby ROI — `apps/web/app/api/v1/lobbies/[id]/route.ts`

In the board row build (the `.map` producing `{ userId, name, score, balance, won, def, borrowed, you }`), add:
```ts
roi: standing.defaultPoints > 0n
  ? Math.round((Number(standing.winnings - standing.borrowed) / Number(standing.defaultPoints)) * 1000) / 10
  : 0,
```
(net lobby profit = `winnings − borrowed`; ROI = that / seed; same shape as the global `roi` number — a 1-decimal growth %.)

Change the sort from `score` to ROI, tie-break score:
```ts
boardRows.sort((a, b) => b.roi - a.roi || b.score - a.score);
```

### 4. Lobby board UI — `apps/web/components/screens-lobby.tsx`

- `BoardRow` (`:33`): add `roi: number`.
- `LobbyBoard` (`:500`): add an **ROI** column (header `lobby.colRoi`) rendering `pctSigned(p.roi)` with `sgnCol`-style green/red; keep the existing Default/Winnings/Borrowed/Score columns (Score still informative). ROI is the primary/leftmost stat column (it's now the ranked key). Keep `.scroll-x` responsiveness; `hide-mobile` on the secondary columns as today.
- New i18n key `lobby.colRoi` (EN `'ROI'`, VI `'ROI'`) in both dictionaries.

---

## Testing

- **Unit (vitest):** `apps/web/lib/format.test.ts` for `pctSigned`: `24.1→'+24.1%'`, `-6.5→'-6.5%'`, `0→'0%'`, `0.04→'0%'` (rounds), `100→'+100%'`.
- **Manual (jsdom has no layout):** Home summary + Home ROI stat show `-6.5%` (not `+-6.5%`) for a negative user; full leaderboard unchanged; lobby board ranked by ROI with an ROI column, signs correct.
- **Verification gate:** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (existing pass count + the new `pctSigned` tests; the pre-existing `Flag` fail stays).

---

## Out of scope / non-goals
- No change to the **global** ranking (netProfit desc, tie roi) or its roi formula — only its formatting is unified.
- No new lobby DB fields — lobby ROI is derived in the route from existing `winnings`/`borrowed`/`defaultPoints`.
- Guest Landing page has no leaderboard — nothing to change there.
