# Design: Realtime Data (notifications · lobby chat · match sync)

**Date:** 2026-06-07
**Status:** Approved (design) — pending spec review → writing-plans

## Goal

Replace polling/fetch-once with realtime push for: (1) **notifications**, (2) **lobby chat**, (3) **match-data sync** — lineups, match info, odds, results + **payout/settlement** — pushed live both when the **worker** updates (AI crawl, livescore, result-check→settle) and when an **admin** updates (sync/confirm/odds/lock/lineup).

## Decisions (locked)

- **Transport: SSE + Redis pub/sub.** Web SSE route (EventSource) subscribes to Redis channels; worker + web routes publish to Redis. Reuses existing Redis; no extra server/port. **Adds `ioredis` to `apps/web`** (new dep).
- **Notifications: persistent feed + unread.** Reuse the (currently unused) `Notification` model + add a `readAt DateTime?` field (**small migration**). Bell + unread count + history; SSE pushes new ones live.
- **Match updates: signal → client re-fetch.** Publish a light `match.update {matchId}` event; client re-fetches `/matches[/:id]`. Settlement publishes `user.{id}` → client re-fetches `/me` + bets. (Chat is the exception: chat events carry the message payload — small + ordered.)

## Architecture

```
        ┌──────────── Redis pub/sub (event bus) ────────────┐
        │  channels: user.{id} · lobby.{id} · matches        │
        └──────▲───────────────────────────────────▲────────┘
   publish │                                         │ publish
 WORKER (NestJS): lineup crawl · result-check→settle │  WEB routes: admin sync/confirm/
 · livescore poll  ───────────────────────────────► │  odds/lock/lineup · chat POST · settle/borrow
                                                     │
                                   ┌─────────────────▼──────────────┐
                                   │ WEB SSE  GET /api/v1/stream      │ (authed)
                                   │ subscribes: user.{id} + matches  │
                                   │ + lobby.{lid} for each membership│
                                   └─────────────────┬──────────────┘
                                       EventSource   │
                                   ┌─────────────────▼──────────────┐
                                   │ CLIENT useRealtime hook          │
                                   │ notif toast/bell · chat append · │
                                   │ match re-fetch · balance/bets    │
                                   └──────────────────────────────────┘
```

### Channels
- `user.{userId}` — notifications + settlement (balance/bets refresh).
- `lobby.{lobbyId}` — chat messages (+ lobby board changes).
- `matches` — global match changes (`match.update {matchId}`); client filters by the match(es) on screen.

### Event shape
`{ type: string, ...payload }` JSON. Types: `notification` (full notif object), `chat` (full message), `match.update` ({matchId}), `match.settled` ({matchId}) on `matches`; settlement also emits `user.{id}` `notification` + a `refresh` ({what:'me'}) signal.

---

## R0 — Realtime foundation

**New package `@wc/realtime`** (`packages/realtime`), depends on `ioredis`:
- `publishEvent(channel: string, event: object): Promise<void>` — lazy singleton publisher (ioredis from `REDIS_URL`, same parse as `apps/worker/src/redis.ts`).
- `createSubscriber(channels: string[], onMessage: (channel, event) => void)` — a dedicated ioredis subscriber; returns `{ close() }`.
- `channels = { user: (id) => 'user.'+id, lobby: (id) => 'lobby.'+id, matches: 'matches' }`.
- Event type unions exported for type-safety.
- Add `ioredis` to `apps/web` deps (worker gets it transitively via this package).

**Web SSE route `GET /api/v1/stream`** (`apps/web/app/api/v1/stream/route.ts`, `dynamic = 'force-dynamic'`):
- `requireAuth` (getSessionUser → 401).
- Resolve the user's channels: `user.{id}`, `matches`, and `lobby.{lid}` for each `LobbyMembership`.
- Return a `ReadableStream` with `Content-Type: text/event-stream`; on each Redis message write `data: {json}\n\n`; 25s heartbeat comment (`: ping\n\n`); on `req.signal` abort → `subscriber.close()`.

**Client `useRealtime`** (`apps/web/lib/realtime.ts` + wired in `app-shell`):
- A module-level `EventSource` singleton opened when `authed` (in app-shell), closed on logout.
- A subscribe registry: `onRealtime(type, handler): () => void`; the singleton's `onmessage` parses + dispatches to handlers by `type`.
- `useRealtime(type, handler)` hook = register on mount, unregister on unmount.
- app-shell wires: `match.settled`/`refresh` → `refreshUser()`; `notification` → unread++ + toast.

**Testing:** unit `@wc/realtime` channel helpers + event serialization (fake ioredis); SSE route shape (auth 401 unauth). Client hook smoke (mock EventSource).

---

## R1 — Notifications (persistent feed + unread)

- **Migration:** `Notification.readAt DateTime?` (nullable).
- **Helper `notify(prisma, userId, type, payload)`** (in `@wc/prediction`): insert `Notification {channel:'IN_APP', status:'SENT', payload, type}` + `publishEvent(channels.user(userId), { type:'notification', notification })`.
- **Emit on** (high-value set): bet **settled** (won `+X` / lost), **borrow** request approved/rejected, **duel** challenged/accepted/resolved. (Mission/news deferred.)
- **Endpoints:** `GET /api/v1/me/notifications/feed` → recent 30 + `unread` count; `POST /api/v1/me/notifications/read` → set `readAt=now()` for the user's unread (or by ids). (Existing `GET /me/notifications` = prefs, unchanged.)
- **UI:** a bell button (topbar/rail) with unread badge → dropdown panel (recent list, mark-read on open); `useRealtime('notification')` → unread++ + toast. Loads `/feed` on mount.

**Testing:** `notify` inserts + publishes (fake prisma/publish); feed route unread count; bell renders unread badge + list (mock fetch + a pushed event).

---

## R2 — Lobby chat realtime

- **Publish:** in `POST /api/v1/lobbies/[id]/messages`, after insert → `publishEvent(channels.lobby(id), { type:'chat', message })` (message = the stored row in UI shape).
- **Client:** `LobbyChat` keeps the initial fetch; add `useRealtime('chat', …)` filtered to the current `lobbyId` → append the message (dedupe by id; skip if it's the sender's own already-optimistic message). Drop the fetch-once limitation.

**Testing:** messages route publishes on send (fake publish); LobbyChat appends a pushed `chat` event for the open lobby.

---

## R3 — Match-data sync + realtime payout

- **Worker publishers:** `updateLiveScores` (per changed match) → `match.update {matchId}` on `matches`; `refreshMatchLineups` → `match.update`; result-check `settle` job + `settleMatch` → `match.settled {matchId}` on `matches` + per settled user `publishEvent(user.{id}, {type:'notification', …})` + `{type:'refresh', what:'me'}`.
- **Web admin publishers:** `sync-result`, `odds` (+`/odds` save), `lock-betting`, `sync-lineup`, `resettle` → `match.update {matchId}`; `resettle` (settles) → also publish to each affected user's channel (refresh + win/lose notification).
- **Client:** `Schedule` + `MatchDetail` register `useRealtime('match.update', e => …)` → debounced re-fetch of the list / the open match (`if e.matchId === id`). `app-shell` already handles `refresh`/`match.settled` → `refreshUser()` (balance + bets update live). User sees odds/lineup/score/result + their settled payout update without reload.

**Settlement payout realtime (the "tính & trả thưởng" ask):** `settleMatch` credits wallets (already). The new publish step notifies each better's `user.{id}` → client `refreshUser()` (new balance + WON/LOST bets) + a "You won +X / lost" notification — live, no reload.

**Testing:** settle publishes a `user.{id}` event per settled prediction (fake publish in a settle unit test); admin route publishes `match.update`; MatchDetail re-fetches on a pushed `match.update` for its id.

---

## Error handling
- SSE: on Redis error/disconnect → close stream; EventSource auto-reconnects (built-in); server re-subscribes on reconnect. Heartbeat keeps proxies from killing idle connections.
- Publish failures are non-fatal (wrap in try/catch; the DB write already succeeded — realtime is best-effort, polling/refresh still works as fallback).
- If `REDIS_URL` is unreachable: publish no-ops (logged); SSE returns an empty/heartbeat stream; the app still works via existing fetch-on-action.

## Sequencing (one phase per run, stop-for-review)
1. **R0** — `@wc/realtime` + `ioredis` + `/api/v1/stream` SSE + `useRealtime` hook + app-shell wiring.
2. **R1** — `Notification.readAt` migration + `notify` + feed/read endpoints + bell UI + emit on settle/borrow/duel.
3. **R2** — chat publish + live append.
4. **R3** — worker + admin match publishers + Schedule/MatchDetail re-fetch + settlement→payout push.

## Scope / stop-conditions (approved via decisions)
- **New dep:** `ioredis` on `apps/web` (+ `@wc/realtime` package).
- **Migration:** `Notification.readAt`.
- **Out of scope:** WebSocket/bidirectional (chat send stays a POST); web push/email delivery (separate deferred infra); horizontal scaling of SSE (single-node `next start` assumed — Redis pub/sub already supports multi-node later).
