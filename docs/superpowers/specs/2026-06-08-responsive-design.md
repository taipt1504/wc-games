# Responsive (Mobile & Tablet) Design

**Date:** 2026-06-08
**Scope:** `apps/web` player-facing surface only. Admin console stays desktop-first (out of scope, mirrors the i18n decision).
**Constraint:** Frontend/CSS only — **no logic changes**, **no new dependencies** (keep the custom CSS + design-token system; no Tailwind).
**Targets:** mobile floor **360px** (portrait + landscape), tablet **768–1023px**, desktop **≥1024px**. Maximize device compatibility.

---

## Goal

Make every player-facing screen usable and well-laid-out from 360px phones through tablets to desktop, via a small, documented, reusable responsive layer — not scattered one-off media queries. Logic, data flow, and component behavior are untouched; only layout/CSS/markup-class changes.

## Problem (current state)

- Styling = a single `app/globals.css` (design tokens as CSS vars) + heavy **inline `style={{}}`** in components (fixed-px paddings, `gridTemplateColumns: repeat(auto-fill, minmax(Npx,1fr))`, fixed `minWidth`s).
- Responsive is partial and ad-hoc: shell rail↔tabs at `880`, pub-nav↔substrip at `820`, modal→sheet at `520`, specific grids by id at `760`, `only-mobile` at `881`. **Five inconsistent breakpoints, no single source of truth.**
- Likely mobile breakage: data tables (`leaderboard`, `groups`, lobby board) overflow; dense inline-px rows don't wrap; no fluid type/spacing; some fixed `minmax` mins can overflow narrow widths.

## Architecture (Approach A — tokens + fluid-first utilities + targeted class-ification)

### 1. Breakpoint convention (single documented source)

Plain CSS `@media` cannot read CSS custom properties, and we are not adding a PostCSS/SCSS plugin (no new deps). The single source of truth is therefore a **documented constant set used verbatim everywhere**, declared in a comment block at the top of `responsive.css`:

```
/* BREAKPOINTS — the only values any @media in this app may use:
   mobile  : max-width 767px
   tablet  : 768px – 1023px
   desktop : min-width 1024px
   phone-sheet (modal→bottom sheet): max-width 640px   */
```

Mapping of the old breakpoints → canonical:
- rail↔bottom-tabs: `880` → **`1024`** (rail desktop-only; tablet uses bottom tabs).
- pub-nav↔substrip: `820` → **`1024`**.
- id-specific grid collapses (`760`): folded into `.grid-auto` (no longer needed) or `768`.
- modal→bottom-sheet: `520` → **`640`**.
- `only-mobile` gate `881` → `1024`.

Tradeoff (accepted): viewports `880–1023px` (large tablets / small laptop windows) now show the bottom-tab shell instead of the rail. Cleaner tiering; acceptable.

### 2. File layout

- **New `app/responsive.css`** — imported once in `app/layout.tsx` immediately after `globals.css`. Contains the entire reusable responsive layer: breakpoint doc, fluid tokens, utility classes, consolidated component grid/table rules.
- **`app/globals.css`** — edited minimally: re-point the existing shell media queries (`rail`/`tabs`/`pubbar`/`modal`) to canonical values; make `.page` / `.topbar` / `.pubbar-inner` padding fluid. The shell layout stays in globals (its home); only reusable primitives move to `responsive.css`.

Rationale: one isolated, documented responsive layer is easy to find, reason about, and maintain; globals churn stays small.

### 3. Fluid-first tokens (fewer breakpoints)

`clamp()` so spacing/type scale smoothly 360→desktop without per-screen media queries:
- `--page-pad-x: clamp(12px, 3vw, 20px)`, `--page-pad-y: clamp(16px, 3vw, 24px)` — `.page` uses these.
- Headings fluid: `h1`/`.h1`, `h2`/`.h2`, `.h3` get `clamp()` sizes (cap at current desktop values; floor sized for 360px). Base body font may get a small clamp if needed.
- These tokens are defined in `responsive.css` and override/extend the static values; existing token names elsewhere are untouched.

### 4. Reusable utility classes (replace breaking inline px)

- `.grid-auto` — `display:grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--col-min, 240px)), 1fr)); gap: var(--gap, 12px);`. The `min(100%, …)` guarantees no horizontal overflow at 360px. Per use, set `--col-min`/`--gap` inline (data, not layout) or via a modifier. Replaces the inline `repeat(auto-fill, minmax(Npx,1fr))` grids.
- `.scroll-x` — `overflow-x:auto; -webkit-overflow-scrolling:touch;` touch-scroll wrapper for wide data tables and the knockout bracket (`min-width:1100`).
- `.stack-md` — force `flex-direction:column` below 768px (for `.row.between` blocks that must stack on phones).
- `.row` — gains `flex-wrap:wrap` where dense rows would overflow (applied via a `.row-wrap` helper or targeted rule; existing `.row` semantics preserved by using an opt-in class).
- Visibility: `.hide-mobile` (`<768`, keep existing), `.hide-tablet` (`768–1023`), `.only-mobile` (hidden `≥768`), `.only-desktop` (hidden `<1024`).

### 5. Tables

Baseline: wrap each data table (`leaderboard`, `groups`, lobby board) in a `.scroll-x` container so columns stay intact and scroll horizontally on phones (≥40px tap rows). Existing `hide-mobile` on low-priority columns kept. No card-collapse in this pass (can be a later enhancement).

### 6. Shell responsive (globals.css consolidation)

- `.rail` shown `≥1024`; `.tabs` (bottom nav) shown `<1024`; `.with-rail` padding-left applies `≥1024` only.
- `.topbar` / `.pubbar-inner` horizontal padding fluid; `.points-pill` compact on mobile (smaller padding/label) — visual only.
- `.pub-substrip` shown `<1024`, `.pub-nav` hidden `<1024`.
- Modal → bottom sheet at `≤640`.
- Bottom-tab + content already account for `env(safe-area-inset-bottom)`; keep.

### 7. Component pass — phased (one phase per run, stop for review)

Each phase: swap only the **breaking** inline-px (fixed `minWidth`, non-wrapping rows, fixed `minmax` grids, dense paddings) onto the utilities above. **No logic, no prop, no data changes.** Keep EN/VI catalogs and all behavior intact.

- **P0 — Architecture:** create `responsive.css` + import; consolidate globals shell breakpoints; add fluid tokens + utility classes + table/grid rules. Verify build + 122 tests + `width=device-width` meta.
- **P1 — screens-core** (landing / auth / home): hero, stat grid, check-in card, mission/leaderboard panels.
- **P2 — screens-match** (schedule list, match detail, bet slip, micro widget).
- **P3 — screens-compete** (leaderboard table + cards, my-bets, wallet, shop grid, profile) — includes the table `.scroll-x`.
- **P4 — screens-lobby** (lobby list, create wizard, lobby view tabs/board/chat/members).
- **P5 — screens-tournament** (teams grid, team detail, groups tables, knockout bracket `.scroll-x`) **+ screens-news** (wire/hero/article).

### 8. Verification

No browser in this environment, so:
- **Automated:** `pnpm --filter @wc/web exec tsc --noEmit` clean; `pnpm --filter @wc/web test` stays **122 pass** (CSS-only changes; jsdom render tests assert text/structure, not layout). Class-name swaps must not change asserted text/roles.
- **Static audit (per screen):** no element forces width >360px without `min()` / wrap / `.scroll-x`; grids use `.grid-auto`; dense rows wrap; tap targets ≥40px; no inline fixed `minmax` mins left on player screens.
- **Meta check:** confirm `app/layout.tsx` still emits `<meta name="viewport" content="width=device-width, initial-scale=1">` (Next default; the `viewport` export sets only `themeColor`, so the default must remain in effect).
- **Manual:** user spot-checks at 360 / 414 / 768 / 1024 widths in devtools and on real devices.

## Out of scope

- Admin console responsiveness.
- Logic / data / behavior changes of any kind.
- New dependencies, Tailwind, CSS preprocessors/PostCSS plugins.
- Table card-collapse (possible later enhancement).
- Visual redesign beyond what responsiveness requires.

## Success criteria

- Every player-facing screen is usable with no horizontal overflow / clipped content from 360px through desktop, portrait and landscape.
- Responsiveness is driven by one documented breakpoint convention + the reusable `responsive.css` utilities — no new ad-hoc breakpoints, minimal inline-px.
- `tsc` clean, 122 web tests green, behavior unchanged.
