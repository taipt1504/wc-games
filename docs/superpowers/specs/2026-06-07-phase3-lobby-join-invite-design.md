# Phase 3 — Lobby join + invite — Design

> Date: 2026-06-07 · Status: Approved (design) · Scope: `packages/auth`, `apps/web`
> Source: master plan Phase 3 + review `docs/reviews/review-060626-v1.md` (image.png/-1/-2) + supporting-modules SD §A.

## Problem (current state — all mock)
- LobbyCard "Join" → toasts + navigates, **no API call**.
- "Invite code or link" input + Join → toasts only, **no resolve/join**.
- LobbyCreate password field → `defaultValue="goal2026"` placeholder; create route **ignores password** (no lobby is protected).
- LobbyView "Invite" → toasts "copied", **no real link/clipboard**.
- `joinLobby` skips password; no invite-resolve endpoint.

## Decisions (locked)
| # | Decision | Choice |
|---|---|---|
| 1 | Invite link open behavior | **Auto-attempt join** (password modal if protected) |
| 2 | Link format | **`${origin}/?join=CODE`** (query param; single-page router). Input also accepts raw code or full link |
| 3 | Password model | **Optional per lobby** — protected → modal; public → direct |
| 4 | Password hashing | Generic `hashSecret`/`verifySecret` in `@wc/auth` (reuse bcryptjs; no new dep) |

## Backend
1. **`@wc/auth`** — export `hashSecret(plain): Promise<string>` + `verifySecret(plain, hash): Promise<boolean>` (bcryptjs, BCRYPT_ROUNDS). Rebuild dist.
2. **`apps/web/lib/lobby.ts`** (new) — `verifyLobbyPassword(lobby, password?): Promise<'OK'|'PASSWORD_REQUIRED'|'WRONG_PASSWORD'>` + `parseInviteCode(raw): string` (extract token from a `?join=`/path link or raw code → trim+upper).
3. **`lobbies` POST** — `CreateSchema` gains optional `password` (4–64 chars). If present → `hashSecret` → pass `passwordHash` to `createLobby`.
4. **`lobbies/[id]/join` POST** — body `{password?}`. `verifyLobbyPassword` → `401 {code:'PASSWORD_REQUIRED'}` / `401 {code:'WRONG_PASSWORD'}` else `joinLobby`. (ALREADY_MEMBER → 409.)
5. **`lobbies/join-by-code` POST** (new) — `{code, password?}`. `parseInviteCode` → find by `inviteToken` (404 `INVALID_CODE`) → password gate → `joinLobby`. ALREADY_MEMBER → `{ id, alreadyMember:true }`. Returns `{ id }`.

## Frontend (`screens-lobby.tsx`, `app-shell.tsx`)
- **`LobbyPasswordModal`** (shared): lobby name + password input + inline error + submit/cancel.
- **LobbyCard Join** — POST join; `PASSWORD_REQUIRED` → open modal (remember lobby) → retry with password; `WRONG_PASSWORD` → modal error; 201/ALREADY_MEMBER → `go('lobby', {id})` + refresh.
- **Invite-code input + Join** — `join-by-code`; same modal flow; `INVALID_CODE` → toast.
- **LobbyCreate** — send `password` when set; remove `goal2026` default.
- **LobbyView Invite** — `navigator.clipboard.writeText(`${location.origin}/?join=${l.code}`)` + toast (fallback: toast the link if clipboard blocked).
- **Auto-join** — `app-shell` reads `?join=CODE` on mount → `go('lobbies', { join: CODE })`, strips param via `history.replaceState`. `Lobbies` reads `s.param.join` → prefills input + auto-attempts `join-by-code` once (password modal if protected; if 401 unauth → toast + `go('auth')`).

## Testing
- `@wc/auth`: hash/verify roundtrip + wrong-password unit test.
- `join-by-code`: `parseInviteCode` unit (raw code, full link, lowercase); route resolve + password gate.
- Lobby UI: card-join calls API + opens modal on PASSWORD_REQUIRED; invite-code join; existing lobby tests updated (Join was mock).
- Manual live: create protected lobby → join wrong/right password → copy invite link → join-by-code → auto-join via `?join=`.

## Stop-conditions
None — no new dependency, no migration (`passwordHash`/`inviteToken` exist).
