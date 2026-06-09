# Lineup Diagram Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `FormationPitch` always render a pitch diagram — real formation + subs when a starting XI exists, a default **4-3-3** + subs when only the squad roster exists — replacing the flat grouped-roster list.

**Architecture:** Extract a pure, exported `deriveLineup(players, formation)` → `{ lines, subs, formationLabel }` (TDD'd). Rewrite `FormationPitch` to one shared render shell driven by `lines`. Single file: `apps/web/components/formation-pitch.tsx` (+ a new test). No call-site/API change.

**Tech Stack:** React (Next 15, custom CSS), Vitest (jsdom), `useT()` i18n.

**Verification gate (each code task):** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test`. KNOWN pre-existing failure: `Flag > shows team code` (unrelated — do NOT fix). Success = no NEW failures + the new `deriveLineup` tests pass.

**Reference (current file, for context):** `formation-pitch.tsx` already exports `LineupPlayer`, and has module-level `BANDS: Band[] = ['FWD','AM','DM','DEF','GK']`, `bandOf(pos)`, `sideRank(pos)`, a `Chip` component, plus `RosterGroup` + `BAND_LABELS` (to be removed) and the `FormationPitch` component (to be rewritten).

---

## Task 1: `deriveLineup` pure helper (TDD)

**Files:**
- Create: `apps/web/components/formation-pitch.test.tsx`
- Modify: `apps/web/components/formation-pitch.tsx` (add `DerivedLineup` interface + `deriveLineup` export; reuse existing `BANDS`/`bandOf`/`sideRank`)

- [ ] **Step 1: Write the failing test** — create `apps/web/components/formation-pitch.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { deriveLineup, type LineupPlayer } from './formation-pitch';

const P = (name: string, position: string | null, opts: Partial<LineupPlayer> = {}): LineupPlayer =>
  ({ name, position, number: opts.number ?? null, starter: opts.starter });

const band = (b: string, n: number): LineupPlayer[] =>
  Array.from({ length: n }, (_, i) => P(`${b}${i + 1}`, b));

describe('deriveLineup', () => {
  it('real XI: starters split into bands (top→bottom), rest to subs, passed formation', () => {
    const players: LineupPlayer[] = [
      P('GK1', 'GK', { starter: true, number: 1 }),
      P('CB1', 'CB', { starter: true, number: 4 }), P('CB2', 'CB', { starter: true, number: 5 }),
      P('CM1', 'CM', { starter: true, number: 8 }),
      P('ST1', 'ST', { starter: true, number: 9 }),
      P('Sub1', 'DEF', { number: 13 }), P('Sub2', 'MID', { number: 14 }),
    ];
    const r = deriveLineup(players, '4-2-3-1');
    expect(r.formationLabel).toBe('4-2-3-1');
    expect(r.subs.map((p) => p.name)).toEqual(['Sub1', 'Sub2']);
    // lines top→bottom, empty bands dropped: FWD[ST1], DM[CM1], DEF[CB1,CB2], GK[GK1]
    expect(r.lines.flat().map((p) => p.name)).toEqual(['ST1', 'CM1', 'CB1', 'CB2', 'GK1']);
    expect(r.lines[0].map((p) => p.name)).toEqual(['ST1']);
    expect(r.lines[r.lines.length - 1].map((p) => p.name)).toEqual(['GK1']);
  });

  it('no XI: default 4-3-3 from coarse roster, subs = the rest', () => {
    const players = [...band('GK', 3), ...band('DEF', 8), ...band('MID', 8), ...band('FWD', 7)]; // 26
    const r = deriveLineup(players);
    expect(r.formationLabel).toBe('4-3-3');
    expect(r.lines.map((l) => l.length)).toEqual([3, 3, 4, 1]); // FWD, MID, DEF, GK
    expect(r.lines[0][0].name).toBe('FWD1');
    expect(r.lines[r.lines.length - 1][0].name).toBe('GK1');
    expect(r.subs.length).toBe(26 - 11);
  });

  it('no XI short forwards: show fewer, never fabricate', () => {
    const players = [...band('GK', 2), ...band('DEF', 5), ...band('MID', 5), ...band('FWD', 2)]; // 14
    const r = deriveLineup(players);
    expect(r.lines.map((l) => l.length)).toEqual([2, 3, 4, 1]); // FWD only 2
    expect(r.subs.length).toBe(14 - 10);
  });

  it('empty roster → empty result', () => {
    expect(deriveLineup([])).toEqual({ lines: [], subs: [], formationLabel: '' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/web test formation-pitch`
Expected: FAIL — `deriveLineup` is not exported.

- [ ] **Step 3: Implement `deriveLineup`** — in `formation-pitch.tsx`, add right ABOVE the `Chip` component (so it sits after `sideRank` and reuses `BANDS`/`bandOf`/`sideRank`):

```tsx
export interface DerivedLineup { lines: LineupPlayer[][]; subs: LineupPlayer[]; formationLabel: string }

/** Build pitch lines (top→bottom = attack→goal) + substitutes. Real XI (any `starter`) → the 5-band
 *  split of starters with the passed formation. No XI → a default 4-3-3 (1 GK / 4 DEF / 3 MID / 3 FWD)
 *  picked by position bucket; short buckets show fewer (never fabricated), everyone unplaced → subs. */
export function deriveLineup(players: LineupPlayer[], formation?: string | null): DerivedLineup {
  if (players.length === 0) return { lines: [], subs: [], formationLabel: '' };

  const starters = players.filter((p) => p.starter);
  if (starters.length > 0) {
    const lines = BANDS
      .map((b) => starters.filter((p) => bandOf(p.position) === b).sort((x, y) => sideRank(x.position) - sideRank(y.position)))
      .filter((row) => row.length > 0);
    return { lines, subs: players.filter((p) => !p.starter), formationLabel: formation ?? '' };
  }

  // No starting XI: arrange a common 4-3-3 from the squad's coarse buckets.
  const inBands = (bs: Band[]) => players.filter((p) => bs.includes(bandOf(p.position)));
  const gk = inBands(['GK']).slice(0, 1);
  const def = inBands(['DEF']).slice(0, 4);
  const mid = inBands(['DM', 'AM']).slice(0, 3);
  const fwd = inBands(['FWD']).slice(0, 3);
  const onPitch = new Set<LineupPlayer>([...gk, ...def, ...mid, ...fwd]);
  const lines = [fwd, mid, def, gk].filter((row) => row.length > 0); // top→bottom
  return { lines, subs: players.filter((p) => !onPitch.has(p)), formationLabel: '4-3-3' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/web test formation-pitch`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/formation-pitch.tsx apps/web/components/formation-pitch.test.tsx
git commit -m "feat(web): deriveLineup — pitch lines + subs (real XI or default 4-3-3)"
```

---

## Task 2: Rewrite `FormationPitch` render + `Chip` fallback; remove the list fallback

**Files:**
- Modify: `apps/web/components/formation-pitch.tsx`

- [ ] **Step 1: Chip — show position in the circle when there's no shirt number.** Replace the number-circle line in `Chip` (`<div … >{p.number ?? ''}</div>`) so it falls back to the position abbrev (FD squads have no numbers):

Change the circle's content from `{p.number ?? ''}` to `{p.number ?? p.position ?? ''}`. (The circle is 32px / fontSize 12 — `DEF`/`CAM`/`RWB` all fit. Leave all other Chip styling unchanged.)

- [ ] **Step 2: Replace the whole `FormationPitch` component body** with the shared-shell version driven by `deriveLineup`:

```tsx
export function FormationPitch({ players, formation, manager }: { players: LineupPlayer[]; formation?: string | null; manager?: string | null }) {
  const { t } = useT();
  const { lines, subs, formationLabel } = deriveLineup(players, formation);

  return (
    <div className="stack gap-12">
      {(manager || formationLabel) && (
        <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
          <div className="row gap-8">{manager && <><Icon name="user" size={16} className="muted" /><span className="small" style={{ fontWeight: 700 }}>{manager}</span></>}</div>
          {formationLabel && <span className="badge badge-sky">{formationLabel}</span>}
        </div>
      )}

      {lines.length > 0 && (
        <div className="card" style={{ position: 'relative', aspectRatio: '3 / 4', maxWidth: 560, margin: '0 auto', width: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(0deg, #0f3a26 0 10%, #11402b 10% 20%)', border: '1px solid var(--line-strong)' }}>
          <svg viewBox="0 0 300 400" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
            <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5">
              <rect x="8" y="8" width="284" height="384" rx="2" />
              <line x1="8" y1="200" x2="292" y2="200" />
              <circle cx="150" cy="200" r="40" />
              <rect x="90" y="8" width="120" height="50" /><rect x="90" y="342" width="120" height="50" />
            </g>
          </svg>
          <div className="stack" style={{ position: 'relative', height: '100%', padding: '12px 4px', justifyContent: 'space-around' }}>
            {lines.map((row, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-around', alignItems: 'center', gap: 2 }}>
                {row.map((p, j) => <Chip key={j} p={p} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {subs.length > 0 && (
        <div>
          <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{t('tournament.bench')}</div>
          <div className="grid-fill" style={{ '--col-min': '170px', '--gap': '8px' } as React.CSSProperties}>
            {subs.map((p, i) => (
              <div key={i} className="card-2" style={{ borderRadius: 'var(--r-xs)', padding: '8px 12px', textAlign: 'center' }}>
                <div className="row center gap-8 small" style={{ minWidth: 0 }}>
                  <span className="tnum muted" style={{ flex: 'none' }}>{p.number ?? ''}</span>
                  <span className="t2" style={{ fontWeight: 600 }}>{p.name}</span>
                </div>
                {p.position && <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>{p.position}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remove the dead `RosterGroup` component and the `BAND_LABELS` constant** (lines defining `const BAND_LABELS …` and `function RosterGroup(…) { … }`) — they were only used by the old no-XI list branch, which no longer exists. Do not remove `BANDS`/`bandOf`/`sideRank`/`Chip` (all still used).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: exit 0 (proves no dangling refs to `RosterGroup`/`BAND_LABELS` and the new render type-checks).
Run: `pnpm --filter @wc/web test`
Expected: prior 121 pass + the 4 `deriveLineup` tests; the only failure is the pre-existing `Flag > shows team code`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/formation-pitch.tsx
git commit -m "feat(web): always-pitch lineup diagram (4-3-3 fallback) + subs; drop flat roster list"
```

---

## Task 3: Phase verification + handoff

- [ ] **Step 1:** `pnpm --filter @wc/web exec tsc --noEmit` → exit 0.
- [ ] **Step 2:** `pnpm --filter @wc/web test` → no new failures (only the pre-existing `Flag` fail); `deriveLineup` suite green.
- [ ] **Step 3: Report** + the manual visual check owed (jsdom has no layout engine): (a) a team with only the FD roster (no AI lineup) now shows a **4-3-3 pitch** + substitutes — not a flat list; (b) a team/match with a real AI lineup still shows its real formation + bench; (c) chips with no shirt number show the position in the circle; (d) match detail (both teams) + team detail + admin views all render. STOP for review.

---

## Self-Review

**Spec coverage:** D1 (always 4-3-3 no-XI) → Task 1 no-XI branch (`formationLabel='4-3-3'`, ignores `formation`). D2 (show fewer, no fabricate) → `.slice(0, N)` per bucket + `subs` = unplaced. D3 (polish both cases, drop list) → Task 2 shared shell + Task 2 Step 3 removes `RosterGroup`. Testing → Task 1 test (4 cases). All covered. ✓

**Placeholder scan:** none — full code in every step.

**Type consistency:** `deriveLineup`/`DerivedLineup`/`LineupPlayer`/`Band`/`BANDS`/`bandOf`/`sideRank` names match the existing file + Task 1. The render in Task 2 consumes exactly `{ lines, subs, formationLabel }` as defined in Task 1. `Chip` prop unchanged (`{ p: LineupPlayer }`). ✓

**Note:** `deriveLineup` is a pure function in a `'use client'` `.tsx`; importing it in the vitest test executes the module's top-level imports (React/Icon/useT) but renders nothing — safe, no DOM/hook needed for the assertions.
