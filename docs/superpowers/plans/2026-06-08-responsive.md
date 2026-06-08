# Responsive (Mobile & Tablet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every player-facing screen in `apps/web` usable with no horizontal overflow from 360px phones through tablets to desktop, via one documented responsive layer + reusable utilities — frontend/CSS only, no logic or dependency changes.

**Architecture:** A new `app/responsive.css` (imported after `globals.css`) holds the single breakpoint convention (mobile `<768` / tablet `768–1023` / desktop `≥1024`; phone-sheet `≤640`), fluid `.page` padding tokens, and reusable utilities (`.grid-auto`, `.grid-stack-md`, `.scroll-x`, visibility helpers). `globals.css` shell breakpoints are consolidated to those values. Each player screen then has its breaking inline-px (auto-fit grids, fixed-ratio grids, data tables) swapped onto the utilities. `.h1`/`.h2` are already `clamp()`; `.wrap-w` (flex-wrap) already exists and is reused.

**Tech Stack:** Next 15 App Router, custom CSS + design tokens (no Tailwind), React 19, Vitest + Testing Library (jsdom).

**Cadence:** One phase per run; after each, verify and STOP for review. Commits held unless the user asks. Logic, props, data, text, and the EN/VI catalogs are NEVER changed — only layout classes / inline-style CSS.

**Global verification (every phase):**
- `pnpm --filter @wc/web exec tsc --noEmit` → 0 errors.
- `pnpm --filter @wc/web test` → **122 passed** (CSS/class changes must not alter asserted text/roles).

---

## File Structure

- **Create** `apps/web/app/responsive.css` — the entire reusable responsive layer (breakpoint doc, fluid tokens, utilities, table rules).
- **Modify** `apps/web/app/layout.tsx` — import `responsive.css` after `globals.css`.
- **Modify** `apps/web/app/globals.css` — consolidate shell media-query breakpoints to canonical values; fluid `.page`/`.topbar`/`.pubbar-inner` padding; move `.hide-mobile`/`.only-mobile` to `responsive.css`.
- **Modify** (one per phase) `apps/web/components/screens-core.tsx`, `screens-match.tsx`, `screens-compete.tsx`, `screens-lobby.tsx`, `screens-tournament.tsx`, `screens-news.tsx` — swap breaking inline-px onto utilities.

---

## Task P0: Responsive layer (architecture)

**Files:**
- Create: `apps/web/app/responsive.css`
- Modify: `apps/web/app/layout.tsx:3`
- Modify: `apps/web/app/globals.css` (shell media queries `313–321`, `324–326`, `336–339`, `346–349`; `.page` `300`; `.topbar` `290–294`; `.pubbar-inner` `330`)

- [ ] **Step 1: Create `apps/web/app/responsive.css`**

```css
/* ============================================================
   RESPONSIVE LAYER — single source of truth for breakpoints + fluid
   tokens + reusable layout utilities. Imported once in layout.tsx after
   globals.css. Layout/CSS only — no logic.

   BREAKPOINTS — the ONLY widths any @media in this app may use:
     mobile      : max-width 767px
     tablet      : 768px – 1023px
     desktop     : min-width 1024px
     phone-sheet : max-width 640px   (modal → bottom sheet)
   ============================================================ */

/* ---- Fluid spacing tokens (smooth scale 360 → desktop).
   Headings (.h1/.h2) are already clamp() in globals.css — left untouched. */
:root{
  --page-pad-x: clamp(12px, 3vw, 20px);
  --page-pad-y: clamp(16px, 3vw, 24px);
}

/* ---- Layout utilities (replace breaking inline-px) ---- */

/* Auto-reflow card grid. Set --col-min (+ optional --gap) per use.
   min(100%, …) guarantees one column never overflows a 360px viewport. */
.grid-auto{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(min(100%, var(--col-min, 240px)), 1fr));
  gap:var(--gap, 12px);
}

/* Fixed-ratio multi-column grid that collapses to one column on mobile.
   Keep the desktop grid-template-columns inline; this forces 1col < 768. */
@media (max-width:767px){
  .grid-stack-md{ grid-template-columns:1fr !important; }
}

/* Horizontal touch-scroll wrapper for wide content (data tables, bracket). */
.scroll-x{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
/* Wide tables keep column widths and scroll instead of cramping on phones. */
.scroll-x .tbl{ min-width:480px; }
.scroll-x .tbl th, .scroll-x .tbl td{ white-space:nowrap; }

/* ---- Visibility helpers (canonical breakpoints) ---- */
@media (max-width:767px){ .hide-mobile{ display:none !important; } }
@media (min-width:768px) and (max-width:1023px){ .hide-tablet{ display:none !important; } }
@media (min-width:768px){ .only-mobile{ display:none !important; } }
@media (max-width:1023px){ .only-desktop{ display:none !important; } }
```

- [ ] **Step 2: Import it in `apps/web/app/layout.tsx`** (line 3, right after globals)

```tsx
import './globals.css';
import './responsive.css';
```

- [ ] **Step 3: Consolidate shell breakpoints in `apps/web/app/globals.css`**

Replace the layout-switching block (currently lines ~313–321):

```css
.with-rail{ padding-left:248px; }
@media (max-width: 880px){
  .rail{ display:none; }
  .with-rail{ padding-left:0; }
  .tabs{ display:flex; }
  .main{ padding-bottom:100px; }
  .hide-mobile{ display:none !important; }
}
@media (min-width: 881px){ .only-mobile{ display:none !important; } }
```

with (rail→1024; `.hide-mobile`/`.only-mobile` now live in responsive.css):

```css
.with-rail{ padding-left:248px; }
@media (max-width: 1023px){
  .rail{ display:none; }
  .with-rail{ padding-left:0; }
  .tabs{ display:flex; }
  .main{ padding-bottom:100px; }
}
```

Replace the grid-collapse block (currently lines ~324–326), bumping 760→767 (keep admin id untouched):

```css
@media (max-width: 760px){
  #home-grid, #adm-news-grid, #lobby-tools{ grid-template-columns:1fr !important; }
}
```

with:

```css
@media (max-width: 767px){
  #home-grid, #adm-news-grid, #lobby-tools{ grid-template-columns:1fr !important; }
}
```

Replace the pub-nav block (currently lines ~336–339), 820→1023:

```css
@media (max-width: 820px){
  .pub-nav{ display:none; }
  .pub-substrip{ display:flex; }
}
```

with:

```css
@media (max-width: 1023px){
  .pub-nav{ display:none; }
  .pub-substrip{ display:flex; }
}
```

Replace the modal-sheet block (currently lines ~346–349), 520→640:

```css
@media (max-width:520px){
  .overlay{ align-items:flex-end; padding:0; }
  .modal{ max-width:none; border-radius:var(--r-xl) var(--r-xl) 0 0; animation:sheetUp .3s ease; }
}
```

with:

```css
@media (max-width:640px){
  .overlay{ align-items:flex-end; padding:0; }
  .modal{ max-width:none; border-radius:var(--r-xl) var(--r-xl) 0 0; animation:sheetUp .3s ease; }
}
```

- [ ] **Step 4: Fluid padding in `apps/web/app/globals.css`**

`.page` (line ~300):

```css
.page{ max-width:1080px; margin:0 auto; padding:var(--page-pad-y) var(--page-pad-x); }
```

`.topbar` (line ~293, the `padding:0 20px`):

```css
  display:flex; align-items:center; justify-content:space-between; padding:0 var(--page-pad-x);
```

`.pubbar-inner` (line ~330, the `padding:0 20px`):

```css
.pubbar-inner{ max-width:1200px; margin:0 auto; height:64px; display:flex; align-items:center; gap:24px; padding:0 var(--page-pad-x); }
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @wc/web exec tsc --noEmit` → 0 errors.
Run: `pnpm --filter @wc/web test` → 122 passed.
Confirm `app/layout.tsx` does NOT override Next's default `viewport.width` (it sets only `themeColor`), so `<meta name="viewport" content="width=device-width, initial-scale=1">` is still emitted. If a `width`/`initialScale` is missing from the `viewport` export, that is correct — Next supplies the device-width default.

- [ ] **Step 6: Commit (only if user asks)**

```bash
git add apps/web/app/responsive.css apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat(responsive): responsive layer — breakpoints, fluid tokens, utilities + shell consolidation"
```

**STOP for review.**

---

## Swap rules (used by P1–P5)

Apply ONLY these mechanical transformations. No logic/prop/text changes. React needs a cast for CSS custom properties: `style={{ ['--col-min']: '168px' } as React.CSSProperties}`.

**R1 — auto-fit/auto-fill card grid → `.grid-auto`:**
```tsx
// before
<div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))' }}>
// after  (.grid-auto already sets display:grid + gap; drop the grid/gap-* classes)
<div className="grid-auto" style={{ '--col-min': '168px', '--gap': '12px' } as React.CSSProperties}>
```
Set `--col-min` = the old minmax min; `--gap` = the old `gap-N` value (gap-12→12px, gap-14→14px, gap-16→16px). If the element had other classes (e.g. `mt-16`), keep them.

**R2 — fixed-ratio multi-column grid → add `.grid-stack-md`** (keep the inline `gridTemplateColumns` for desktop):
```tsx
// before
<div className="grid gap-16" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
// after
<div className="grid grid-stack-md gap-16" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
```

**R3 — `repeat(N,1fr)` stat row → `.grid-auto` reflow** (small `--col-min` so cells wrap N→…→1):
```tsx
// before
<div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
// after
<div className="grid-auto" style={{ '--col-min': '100px', '--gap': '12px' } as React.CSSProperties}>
```

**R4 — data table → wrap in `.scroll-x`:**
```tsx
// before
<table className="tbl"> … </table>
// after
<div className="scroll-x"><table className="tbl"> … </table></div>
```

**R5 — non-wrapping horizontal `.row` that overflows → add `wrap-w`** (existing utility):
```tsx
<div className="row gap-8 wrap-w"> … </div>
```

---

## Task P1: screens-core (landing / auth / home)

**Files:** Modify `apps/web/components/screens-core.tsx`

Targets (from inventory):
- `repeat(auto-fit,minmax(136px,1fr))`, `minmax(220px,1fr)`, `minmax(240px,1fr)`, `minmax(280px,1fr)` → **R1** (`--col-min` = 136/220/240/280).
- `minmax(0,1.6fr) minmax(0,1fr)` (home main/side split — has `id="home-grid"`, already collapses at 767 via globals) → **R2** as belt-and-suspenders (add `grid-stack-md`); keep the id.
- `gridTemplateColumns: '1fr'` → leave (already single column).
- Check-in card `minWidth:248`, panel `minWidth:260`: confirm each sits inside a `wrap-w` row; if its parent row lacks `wrap-w`, apply **R5** so the cards wrap instead of overflowing at 360px.

- [ ] **Step 1:** Apply R1 to each auto-fit grid; R2 to the home split; R5 where the 248/260 cards' row doesn't wrap.
- [ ] **Step 2:** `pnpm --filter @wc/web exec tsc --noEmit` → 0 errors.
- [ ] **Step 3:** `pnpm --filter @wc/web test` → 122 passed.
- [ ] **Step 4:** Commit (if asked): `git commit -m "feat(responsive): screens-core mobile/tablet"`

**STOP for review.**

---

## Task P2: screens-match (schedule / match detail / bet slip)

**Files:** Modify `apps/web/components/screens-match.tsx`

Targets:
- `repeat(auto-fill,minmax(300px,1fr))`, `repeat(auto-fit,minmax(300px,1fr))`, `repeat(auto-fit,minmax(150px,1fr))` → **R1** (`--col-min` = 300/300/150).
- `minWidth:0` occurrences → leave (flexbox ellipsis guard; not a layout bug).
- Confirm the bet-slip/odds rows wrap or fit at 360px; apply **R5** to any `.row` of odds/outcome buttons that would overflow.

- [ ] **Step 1:** Apply R1 to the three grids; R5 to any overflowing odds row.
- [ ] **Step 2:** tsc → 0 errors.
- [ ] **Step 3:** test → 122 passed.
- [ ] **Step 4:** Commit (if asked): `git commit -m "feat(responsive): screens-match mobile/tablet"`

**STOP for review.**

---

## Task P3: screens-compete (leaderboard / my-bets / wallet / shop / profile)

**Files:** Modify `apps/web/components/screens-compete.tsx`

Targets:
- `repeat(3,1fr)` (stat row) → **R3** (`--col-min` `100px`).
- `repeat(auto-fit,minmax(110px,1fr))`, `140`, `150`, `180`, `240`, `repeat(auto-fill,minmax(150px,1fr))` → **R1** (matching `--col-min`).
- The **2 `.tbl` tables** (leaderboard + parlay/ledger) → **R4** wrap each in `.scroll-x`. The leaderboard's existing `hide-mobile` columns stay hidden `<768`.
- `minWidth:0` → leave.

- [ ] **Step 1:** Apply R3 to the stat row; R1 to the card grids; R4 to both tables.
- [ ] **Step 2:** tsc → 0 errors.
- [ ] **Step 3:** test → 122 passed (leaderboard/my-bets tests assert text/rows, not layout — class swaps must not change them).
- [ ] **Step 4:** Commit (if asked): `git commit -m "feat(responsive): screens-compete mobile/tablet + table scroll"`

**STOP for review.**

---

## Task P4: screens-lobby (list / create wizard / lobby view)

**Files:** Modify `apps/web/components/screens-lobby.tsx`

Targets:
- `repeat(auto-fill,minmax(280px,1fr))` (×2: lobby list + match picker) → **R1** (`--col-min` `280px`).
- `minmax(0,1.4fr) minmax(0,1fr)` (lobby view main/side split) → **R2** (`grid-stack-md`).
- The **3 `.tbl` tables** (standings / board / members or requests) → **R4** wrap in `.scroll-x`.
- `lobby-tools` grid (has `id`, already collapses at 767 via globals) → no change needed; verify it still has the id.
- `minWidth:0` → leave.

- [ ] **Step 1:** Apply R1 ×2; R2 to the split; R4 to the 3 tables.
- [ ] **Step 2:** tsc → 0 errors.
- [ ] **Step 3:** test → 122 passed (screens-lobby has the largest test file; confirm chat/board/members text unchanged).
- [ ] **Step 4:** Commit (if asked): `git commit -m "feat(responsive): screens-lobby mobile/tablet"`

**STOP for review.**

---

## Task P5: screens-tournament (teams / team / groups / bracket) + screens-news

**Files:** Modify `apps/web/components/screens-tournament.tsx`, `apps/web/components/screens-news.tsx`

screens-tournament targets:
- `repeat(auto-fill,minmax(168px,1fr))` (teams grid), `minmax(320px,1fr)` (groups grid) → **R1** (`--col-min` 168/320).
- The **2 `.tbl`** group standings tables → **R4** wrap in `.scroll-x`.
- Knockout bracket row `minWidth:1100`: it already sits in `<div className="card card-pad" style={{ overflowX:'auto' }}>` — add the `scroll-x` class to that wrapper for consistency (keep `overflowX:auto`); the inner `minWidth:140/180/196/52` bracket cells stay (they scroll horizontally with the bracket — correct).

screens-news targets:
- `repeat(auto-fill,minmax(280px,1fr))` (news grid) → **R1** (`--col-min` `280px`).
- Tag filter row already uses `wrap-w` — no change.

- [ ] **Step 1:** Apply R1 to teams/groups/news grids; R4 to the group tables; add `scroll-x` to the bracket wrapper.
- [ ] **Step 2:** tsc → 0 errors.
- [ ] **Step 3:** test → 122 passed (tournament + news tests assert headings/labels/rows, not layout).
- [ ] **Step 4:** Commit (if asked): `git commit -m "feat(responsive): screens-tournament + screens-news mobile/tablet"`

**STOP — responsive pass complete.** Final manual check by the user at 360 / 414 / 768 / 1024 widths (devtools + real devices).

---

## Self-review notes (coverage vs spec)

- Breakpoint convention (768/1024/640) → P0 responsive.css doc + globals consolidation. ✓
- `app/responsive.css` layer + import → P0. ✓
- Fluid tokens → P0 (`.page` padding; `.h1/.h2` already clamp). ✓
- `.grid-auto`/`.grid-stack-md`/`.scroll-x`/visibility → P0; applied P1–P5. ✓
- Tables `.scroll-x` → P3 (2), P4 (3), P5 (2). ✓
- Shell (rail/tabs/pubbar/modal) → P0. ✓
- Phased screen pass, no logic change, 122-test gate each phase → P1–P5. ✓
- Reuse `.wrap-w` (not a new `.row-wrap`); `minWidth:0` left as flex guards. ✓
