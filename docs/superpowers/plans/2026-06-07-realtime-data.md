# Realtime Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`). **Commits HELD** (feature branch, commit-when-asked) — each phase ends with verification + STOP, no `git commit`.

**Goal:** Realtime push (SSE + Redis pub/sub) for notifications, lobby chat, and match-data/settlement sync — driven by both the worker (AI crawl, livescore, settle) and admin updates.

**Architecture:** New `@wc/realtime` package wraps `ioredis` (`publishEvent` + `createSubscriber`). Worker + web routes `publishEvent` to channels (`user.{id}` · `lobby.{id}` · `matches`). A web SSE route `GET /api/v1/stream` subscribes to the authed user's channels and streams to an `EventSource`; a client `useRealtime` hook dispatches events. Match updates are light signals → client re-fetches; chat carries the message; settlement pushes `user.{id}` → live balance/bets + notification.

**Tech Stack:** ioredis, Next.js route-handler SSE (ReadableStream), React 19, NestJS worker, Prisma, Vitest.

**Sequencing:** R0 → R1 → R2 → R3, one phase per run, STOP between. `ioredis` is already in the lockfile (via BullMQ) and accepts the `REDIS_URL` string directly.

---

# PHASE R0 — Realtime foundation

### Task R0.1: `@wc/realtime` package

**Files:**
- Create: `packages/realtime/package.json`, `packages/realtime/tsconfig.json`, `packages/realtime/src/index.ts`, `packages/realtime/src/index.test.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@wc/realtime",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run" },
  "dependencies": { "ioredis": "^5.4.1" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```
(Match the `ioredis` version already resolved in `pnpm-lock.yaml` — run `grep -A1 'ioredis@' pnpm-lock.yaml | head` and use that exact major.)

- [ ] **Step 2: `tsconfig.json`** (mirror `packages/risk/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "moduleResolution": "node", "rootDir": "./src", "outDir": "./dist", "declaration": true },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: `src/index.ts`**

```ts
import Redis from 'ioredis';

export type RealtimeEvent =
  | { type: 'notification'; notification: unknown }
  | { type: 'chat'; lobbyId: number; message: unknown }
  | { type: 'match.update'; matchId: number }
  | { type: 'match.settled'; matchId: number }
  | { type: 'refresh'; what: 'me' };

export const channels = {
  user: (id: number | bigint | string) => `user.${id}`,
  lobby: (id: number | bigint | string) => `lobby.${id}`,
  matches: 'matches',
};

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let pub: Redis | null = null;
function publisher(): Redis {
  if (!pub) pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
  return pub;
}

/** Best-effort publish — never throws (realtime is non-critical; DB writes already succeeded). */
export async function publishEvent(channel: string, event: RealtimeEvent): Promise<void> {
  try { await publisher().publish(channel, JSON.stringify(event)); }
  catch { /* swallow — clients fall back to fetch-on-action */ }
}

/** Dedicated subscriber for one SSE connection. */
export function createSubscriber(chans: string[], onMessage: (channel: string, event: RealtimeEvent) => void): { close: () => void } {
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  sub.on('message', (channel, payload) => { try { onMessage(channel, JSON.parse(payload) as RealtimeEvent); } catch { /* ignore */ } });
  if (chans.length) void sub.subscribe(...chans);
  return { close: () => { void sub.quit().catch(() => sub.disconnect()); } };
}
```

- [ ] **Step 4: `src/index.test.ts`** (pure helpers — no live Redis)

```ts
import { describe, it, expect } from 'vitest';
import { channels } from './index';

describe('channels', () => {
  it('builds namespaced channel names', () => {
    expect(channels.user(7)).toBe('user.7');
    expect(channels.lobby(3n)).toBe('lobby.3');
    expect(channels.matches).toBe('matches');
  });
});
```

- [ ] **Step 5: Install + build** — `pnpm install` (links the workspace pkg) then `pnpm --filter @wc/realtime build` → tsc success. Run `pnpm --filter @wc/realtime test` → pass.

### Task R0.2: add deps + SSE route

**Files:**
- Modify: `apps/web/package.json` (add `"@wc/realtime": "workspace:*"`), `apps/worker/package.json` (add `"@wc/realtime": "workspace:*"`)
- Create: `apps/web/app/api/v1/stream/route.ts`

- [ ] **Step 1: Add the dep** to both `apps/web/package.json` and `apps/worker/package.json` dependencies: `"@wc/realtime": "workspace:*"`, then `pnpm install`.

- [ ] **Step 2: SSE route**

```ts
import { createSubscriber, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const memberships = await prisma.lobbyMembership.findMany({ where: { userId: user.id }, select: { lobbyId: true } });
  const chans = [channels.user(String(user.id)), channels.matches, ...memberships.map((m) => channels.lobby(String(m.lobbyId)))];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sub = createSubscriber(chans, (_c, ev) => { try { controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`)); } catch { /* closed */ } });
      const ping = setInterval(() => { try { controller.enqueue(enc.encode(': ping\n\n')); } catch { /* closed */ } }, 25_000);
      const close = () => { clearInterval(ping); sub.close(); try { controller.close(); } catch { /* already closed */ } };
      req.signal.addEventListener('abort', close);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
```

- [ ] **Step 3: Verify** — `pnpm --filter @wc/web exec tsc --noEmit` clean. Restart dev; `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/stream` → **401** (unauth). (Authed SSE verified by the client hook in R0.3.)

### Task R0.3: client `useRealtime` hook + app-shell wiring

**Files:**
- Create: `apps/web/lib/realtime.ts`
- Modify: `apps/web/components/app-shell.tsx`

- [ ] **Step 1: `lib/realtime.ts`**

```ts
import { useEffect } from 'react';

type Handler = (ev: { type: string; [k: string]: unknown }) => void;
const handlers = new Map<string, Set<Handler>>();
let es: EventSource | null = null;

export function openRealtime() {
  if (es || typeof window === 'undefined') return;
  es = new EventSource('/api/v1/stream');
  es.onmessage = (m) => {
    try { const ev = JSON.parse(m.data); handlers.get(ev.type)?.forEach((h) => h(ev)); }
    catch { /* ignore heartbeat / bad frame */ }
  };
  es.onerror = () => { /* EventSource auto-reconnects */ };
}
export function closeRealtime() { es?.close(); es = null; }

export function onRealtime(type: string, h: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(h);
  return () => { handlers.get(type)?.delete(h); };
}
export function useRealtime(type: string, h: Handler) {
  useEffect(() => onRealtime(type, h), [type, h]);
}
```

- [ ] **Step 2: Wire into `app-shell.tsx`** — import `{ openRealtime, closeRealtime, onRealtime }`. In the rehydrate effect, after `setAuthed(true)` on a valid `/me`, call `openRealtime()`. In `logout`, call `closeRealtime()`. Add an effect (once) registering global handlers:

```tsx
  useEffect(() => {
    const offRefresh = onRealtime('refresh', () => { void refreshUser(); });
    const offSettled = onRealtime('match.settled', () => { void refreshUser(); });
    return () => { offRefresh(); offSettled(); };
  }, [refreshUser]);
```

- [ ] **Step 3: Verify** — tsc clean; `pnpm --filter @wc/web test` green; restart dev, open the app authed, confirm (browser) the `/api/v1/stream` EventSource connects (Network tab, 200, stays open). **STOP — R0 complete, await review.**

---

# PHASE R1 — Notifications (persistent feed + unread)

### Task R1.1: migration + `notify` helper

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add `readAt DateTime?` to `Notification`)
- Create: migration `packages/db/prisma/migrations/<ts>_notification_read/migration.sql` (hand-authored: `ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);`), apply with `pnpm --filter @wc/db exec prisma migrate deploy` (shadow-DB workaround per session history).
- Create: `packages/prediction/src/notify.ts` + export in `packages/prediction/src/index.ts`

- [ ] **Step 1: schema** — add `readAt DateTime?` after `sentAt` in `model Notification`. Regenerate: `pnpm --filter @wc/db exec prisma generate`.

- [ ] **Step 2: `notify.ts`**

```ts
import type { PrismaClient } from '@wc/db';
import { publishEvent, channels } from '@wc/realtime';

export async function notify(prisma: PrismaClient, userId: bigint, type: string, payload: Record<string, unknown>): Promise<void> {
  const n = await prisma.notification.create({
    data: { userId, type, channel: 'IN_APP', payload, status: 'SENT' },
  });
  await publishEvent(channels.user(String(userId)), {
    type: 'notification',
    notification: { id: Number(n.id), type, payload, createdAt: n.createdAt, readAt: null },
  });
}
```
Add `@wc/realtime` to `packages/prediction/package.json` deps. Export `notify` from the package index.

- [ ] **Step 3: build** — `pnpm --filter @wc/prediction build` (after `@wc/realtime` built).

### Task R1.2: feed + read endpoints

**Files:**
- Create: `apps/web/app/api/v1/me/notifications/feed/route.ts`, `apps/web/app/api/v1/me/notifications/read/route.ts`

- [ ] **Step 1: feed route** `GET` — authed; return recent + unread count:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, channel: 'IN_APP' }, orderBy: { id: 'desc' }, take: 30, select: { id: true, type: true, payload: true, readAt: true, createdAt: true } }),
    prisma.notification.count({ where: { userId: user.id, channel: 'IN_APP', readAt: null } }),
  ]);
  return NextResponse.json({ data: { items: rows.map((r) => ({ id: Number(r.id), type: r.type, payload: r.payload, readAt: r.readAt, createdAt: r.createdAt })), unread } });
}
```

- [ ] **Step 2: read route** `POST` — mark all unread read:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
export const dynamic = 'force-dynamic';
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  await prisma.notification.updateMany({ where: { userId: user.id, channel: 'IN_APP', readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ data: { ok: true } });
}
```

- [ ] **Step 3: Verify** — tsc clean; both routes → 401 unauth.

### Task R1.3: bell UI + emit on events

**Files:**
- Modify: `apps/web/components/app-shell.tsx` (bell in topbar + unread state + `useRealtime('notification')`)
- Modify: `packages/prediction/src/prediction-service.ts` (settle → `notify`), `packages/lobby/src/lobby-service.ts` (borrow approve/reject → `notify`), `packages/prediction/src/duel.ts` (challenge/accept/resolve → `notify`)

- [ ] **Step 1: emit on settle** — in `settleMatch`, after each prediction is updated to WON/LOST, call `notify(prisma, p.userId, 'settle', { matchId: Number(matchId), result: r.won ? 'WON' : 'LOST', payout: Number(payout) })`. (Inside the existing per-prediction loop; `notify` is best-effort.)
- [ ] **Step 2: emit on borrow + duel** — in `lobby-service` borrow-approve/reject and `duel` create/respond/resolve, call `notify(...)` with the relevant type/payload for the target user.
- [ ] **Step 3: bell UI** — in `app-shell` topbar/rail add a bell button with an unread badge; `const [unread, setUnread] = useState(0)` + `const [notifs, setNotifs] = useState([])`; on auth, fetch `/api/v1/me/notifications/feed` → set both; `useRealtime('notification', (ev) => { setNotifs((n) => [ev.notification, ...n].slice(0,30)); setUnread((u) => u+1); toastMsg(...) })`; clicking the bell opens a panel + `POST /me/notifications/read` → `setUnread(0)`.
- [ ] **Step 4: Verify** — `@wc/prediction`+`@wc/lobby` rebuilt; tsc clean; web tests green (add a test: bell shows unread after a pushed `notification` event via the EventSource mock or `onRealtime`). **STOP — R1 complete.**

---

# PHASE R2 — Lobby chat realtime

**Files:**
- Modify: `apps/web/app/api/v1/lobbies/[id]/messages/route.ts` (publish on POST)
- Modify: `apps/web/components/screens-lobby.tsx` (LobbyChat: subscribe + append)

- [ ] **Step 1: publish on send** — in the messages `POST`, after the message row is created, build the UI-shape message and `await publishEvent(channels.lobby(String(id)), { type: 'chat', lobbyId: Number(id), message })`. Import `{ publishEvent, channels }` from `@wc/realtime` (add the dep to web — already added in R0.2).
- [ ] **Step 2: live append** — in `LobbyChat`, after the initial fetch add:

```tsx
  useRealtime('chat', (ev) => {
    if (Number((ev as { lobbyId: number }).lobbyId) !== Number(lobbyId)) return;
    const m = (ev as { message: { who: string; text: string; t: string } }).message;
    setMsgs((prev) => [...prev, m]);
  });
```
(Dedupe if the sender already optimistically appended — key by a client id or skip if last message equals.)

- [ ] **Step 3: Verify** — tsc clean; web tests green; (browser) two sessions in the same lobby see each other's messages live. **STOP — R2 complete.**

---

# PHASE R3 — Match-data sync + realtime payout

**Files:**
- Modify (worker): `packages/pipeline/src/livescore.ts` (`updateLiveScores`/`syncOneMatchResult` → publish `match.update`), `apps/worker/src/schedule/result-check.worker.ts` (on settle enqueue → nothing; settle publish lives in `settleMatch`), `packages/prediction/src/prediction-service.ts` (`settleMatch` → publish `match.settled` + per-user `refresh`)
- Modify (web admin): `sync-result`, `odds`, `lock-betting`, `sync-lineup`, `resettle` routes → publish `match.update`
- Modify (client): `apps/web/components/screens-match.tsx` (Schedule + MatchDetail subscribe → re-fetch)

- [ ] **Step 1: settle publishes** — in `settleMatch` (after the transaction commits), `await publishEvent(channels.matches, { type: 'match.settled', matchId: Number(matchId) })` and, per settled GLOBAL prediction, `await publishEvent(channels.user(String(p.userId)), { type: 'refresh', what: 'me' })` (the `notify` from R1 already covers the win/lose message). Best-effort.
- [ ] **Step 2: worker match.update** — in `updateLiveScores`, for each changed match `await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) })`; in `syncOneMatchResult`, publish after the update; in `refreshMatchLineups`, publish once per match.
- [ ] **Step 3: admin route publishes** — in each of `sync-result`/`odds`/`lock-betting`/`sync-lineup`/`resettle` route handlers, after the DB write, `await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) })`. (`resettle` also re-settles → `settleMatch` already emits `match.settled` + user refresh.)
- [ ] **Step 4: client re-fetch** — in `Schedule`, `useRealtime('match.update', () => debouncedLoad())` (debounce 500ms → `load()`); in `MatchDetail`, `useRealtime('match.update', (ev) => { if (Number(ev.matchId) === id) load(); })`. `app-shell` already calls `refreshUser()` on `match.settled`/`refresh` (R0.3), so balance + bets update live.
- [ ] **Step 5: Verify** — rebuild `@wc/pipeline`+`@wc/prediction`; worker build; web tsc + tests green; (browser/live) admin confirm result → user's Schedule/MatchDetail refresh + balance/bets update + "You won/lost" notification, no reload. **STOP — R3 complete (realtime feature done).**

---

## Self-review notes (addressed)

- **Spec coverage:** transport (R0.1 publishEvent/createSubscriber + R0.2 SSE) ✓; channels ✓; client hook (R0.3) ✓; notifications persistent feed + unread + readAt migration + notify + bell + emit (R1) ✓; chat publish + append (R2) ✓; match.update from worker+admin + settle→user payout/refresh (R3) ✓; best-effort publish ✓; SSE auth + heartbeat + abort cleanup ✓.
- **Placeholders:** new files have full code; modify-steps give exact snippets + insert points.
- **Type consistency:** `RealtimeEvent` union used consistently; `channels.user/lobby` take string (callers pass `String(id)`); `publishEvent`/`createSubscriber`/`notify` signatures match across phases; SSE filters by `ev.matchId`/`ev.lobbyId`.
- **Known notes:** `ioredis` major must match the lockfile (R0.1 Step 1); SSE assumes single-node `next start` (Redis pub/sub supports multi-node later); chat dedupe is a client concern (Step 2 note).
