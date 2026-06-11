# Match Time — Client Timezone Rendering — Design

**Date:** 2026-06-11
**Goal:** Render match kickoff times in the **client's** timezone, reliably and visibly. A UTC+7 user must see the opener (`2026-06-11T19:00:00Z`) as `02:00, 12 Jun`, not a server-tz value. Add a visible GMT-offset label so the applied tz is unambiguous.

**Scope:** `apps/web` only — a shared formatter + a small SSR-safe `<LocalTime>` component + wiring at every match-time render site (player + admin). No DB/API/dep change. Match data is already client-fetched; this is render-only.

---

## Root cause (verified)

- **Data is correct:** the opening match is stored `2026-06-11T19:00:00.000Z`; in `Asia/Ho_Chi_Minh` that is `02:00 12/06`. Not a stale-data bug.
- **`fmt.date`** (`apps/web/lib/i18n/hooks.ts:12-16`): `new Intl.DateTimeFormat(locale, opts).format(new Date(d))` — **no `timeZone` in `opts`**, and no call site passes one. So the rendering timezone is whatever runtime executes the format.
- These are `'use client'` components, but Next.js still **SSR-renders** them for the initial HTML; during SSR `Intl` uses the **server runtime tz** (the `.env` `TIMEZONE=Asia/Ho_Chi_Minh` is *not* wired to Node's `TZ`, so the server may be UTC/other). The visible "23h 11/06" is `19:00Z` rendered in a non-client offset and shown before/instead of a client re-render. There is no hydration guard.

**Fix direction:** render match times client-side, in the client's resolved tz, with the offset shown.

---

## Decisions (approved 2026-06-11)

| # | Decision | Choice |
|---|---|---|
| D1 | Which tz | **Client's timezone** (browser-resolved). Explicit + SSR-safe (render client-side only). |
| D2 | TZ label | **Yes — GMT offset** (e.g. `GMT+7`) appended to player match times. |
| D3 | Scope | **All time displays incl. admin** (admin uses raw `toLocaleString` with no args — same latent bug). |

---

## Architecture

### 1. Offset helpers — `apps/web/lib/format.ts` (extend existing file)

```ts
/** "GMT+7" · "GMT-5" · "GMT+5:30" · "GMT+0" from minutes-ahead-of-UTC. Pure. */
export function formatGmtOffset(minsAheadOfUtc: number): string {
  const sign = minsAheadOfUtc < 0 ? '-' : '+';
  const abs = Math.abs(minsAheadOfUtc);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** The client's GMT offset label for a given instant (DST-correct via the runtime tz). */
export function tzOffsetLabel(d: Date | string | number): string {
  return formatGmtOffset(-new Date(d).getTimezoneOffset());
}
```
- `Date.prototype.getTimezoneOffset()` returns minutes *behind* UTC for the runtime tz; negating gives minutes ahead. Per-date → handles DST. In the browser this is the client's tz.

### 2. SSR-safe renderer — `apps/web/components/local-time.tsx` (new, `'use client'`)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/hooks';
import { tzOffsetLabel } from '@/lib/format';

/** Render an instant in the CLIENT's timezone. SSR-safe: the visible value is computed after mount
 *  (browser tz); `suppressHydrationWarning` avoids a mismatch flash. `withTz` appends "· GMT+7". */
export function LocalTime({ value, opts, withTz = false }: {
  value: string | number | Date;
  opts?: Intl.DateTimeFormatOptions;
  withTz?: boolean;
}) {
  const { fmt } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const base = fmt.date(value, opts);                 // SSR: server tz · client(after mount): browser tz
  if (!mounted) return <span suppressHydrationWarning>{base}</span>;
  return <span>{withTz ? `${base} · ${tzOffsetLabel(value)}` : base}</span>;
}
```
- After mount, `fmt.date` re-runs in the browser → client tz; the component re-renders with the correct local time + label. Because the time text only becomes authoritative post-mount, the server tz never persists in the view.
- Reuses the i18n `locale` + format shape via `useT().fmt` — no behavior/locale drift from the existing `fmt.date`.

### 3. Wire at every match-time site

Replace the raw `fmt.date(...)` / `new Date(...).toLocaleString()` for **match kickoff** with `<LocalTime …>`:

| File | Sites | `withTz` |
|---|---|---|
| `screens-match.tsx` | card status row (`:126`), detail hero (`:419`), detail InfoCell Kickoff (`:436`) | yes |
| `screens-tournament.tsx` | fixtures row (`:129`) | yes |
| `screens-lobby.tsx` | match row (`:294`), picker row (`kickoffFmt`, `:459`) | yes |
| `screens-core.tsx` | Home today eyebrow (`:285`) | no (short label) |
| `screens-admin.tsx` | `:297, :355, :1338, :1445` (raw `toLocaleString`/`toLocaleDateString`) | yes |

- Pass the same `opts` each site uses today (e.g. `{ day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }`); `<LocalTime>` keeps the shape, only fixes the tz + adds the label.
- Admin sites: convert the arg-less `toLocaleString()` to `<LocalTime value={...} opts={{ dateStyle:'medium', timeStyle:'short' }} withTz />` (and `toLocaleDateString()` → date-only opts, no `withTz`).
- Non-kickoff dates (e.g. news `publishedAt`, chat timestamps) are out of scope unless trivially adjacent.

---

## Testing

- **Unit (vitest):** `apps/web/lib/format.test.ts` (existing) gains `formatGmtOffset`: `420→'GMT+7'`, `-300→'GMT-5'`, `330→'GMT+5:30'`, `0→'GMT+0'`, `-60→'GMT-1'`.
- **Manual (jsdom has no tz/layout reality):** in a UTC+7 browser the opener shows `02:00, 12 Jun · GMT+7` (not 23:00/19:00 11 Jun); switching the OS/browser tz changes the displayed time + label accordingly; admin match list shows local time.
- **Verification gate:** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (existing pass + new `formatGmtOffset` tests; the pre-existing `Flag` fail stays).

---

## Out of scope / non-goals
- Server `TIMEZONE` env / scoring-mission cutoffs — unrelated to display.
- `@wc/fixtures` date util (`timeZone:'UTC'`, seed-only — not a display path).
- A user-selectable tz override — YAGNI; the browser tz is the client's tz.
