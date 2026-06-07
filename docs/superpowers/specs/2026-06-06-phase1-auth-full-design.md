# Phase 1 (full) — Auth: JWT access+refresh, Google OAuth — Design

> Date: 2026-06-06 · Status: Approved · Scope: `apps/web`, `packages/auth`
> Source of truth: `docs/solution-design/2026-05-30-auth-account-service-design.md` (UC-02, §7 Security), review `docs/reviews/review-060626-v1.md`.

## Goal

Make login session real and persistent, and make Google login actually work.

Done when:
- F5 does not log the user out (session survives refresh within 30d).
- Login/register issue a short access JWT + a rotating refresh token; `AuthSession` rows are written.
- Logout revokes the server-side session.
- "Continue with Google" runs a real OAuth2 Authorization-Code flow and lands the user logged in.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Google OAuth lib | **Manual OAuth2 + `jose`** (no new dependency) |
| 2 | Google account model | **Email-match + random unusable `passwordHash`** (no migration) |
| 3 | JWT depth | **Full**: short access JWT + refresh-token rotation + `AuthSession` rows |
| 4 | Google creds | Provided by user in `.env` (`GOOGLE_CLIENT_ID/SECRET`); `.env` not touched by us |

No stop-conditions triggered: no new dependency, no DB migration (`AuthSession` model already exists).

## 1. JWT session — access + refresh rotation

**Tokens**
- **Access JWT** — cookie `wc_session`, httpOnly, **1h** TTL. Payload `{ email, role }`, `sub = userId`. Verified by existing `getSessionUser()`.
- **Refresh token** — cookie `wc_refresh`, httpOnly, **30d** TTL. Opaque 32-byte random hex. Stored **sha256-hashed** in `AuthSession.refreshTokenHash` with `ip`, `userAgent`, `expiresAt`.

**Flows**
- **Login / Register**: verify creds → `createAuthSession(prisma, userId, sha256(refresh), ip, ua, +30d)` → set both cookies. Login audit log retained.
- **`POST /api/v1/auth/refresh`** (NEW): read `wc_refresh` → `rotateRefresh()`:
  - no match / expired → `INVALID_REFRESH` → clear cookies, 401.
  - match already revoked → **reuse detected** → revoke all that user's sessions → `REFRESH_REUSE` → clear cookies, 401.
  - else: revoke old row, create new row with new refresh hash → set new access + refresh cookies, 200.
- **Logout**: `revokeSession(sha256(refresh))` + clear both cookies.
- **F5 persistence**: client `apiFetch` wrapper — on `401`, calls `/api/v1/auth/refresh` once and retries the original request. Used by the mount bootstrap and `refreshUser`. Keeps F5 logged in for the 30d refresh window even after access expiry.

## 2. Google OAuth — manual (jose), email-match

- **`GET /api/v1/auth/google`** (NEW): if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` missing → 302 `/?auth_error=google_not_configured` (no fake success). Else: `state` = random hex set in short httpOnly cookie `g_oauth_state` (sameSite=lax so it returns on the callback redirect); 302 to Google auth URL (`response_type=code`, `scope=openid email profile`, `redirect_uri`, `state`, `prompt=select_account`). `redirect_uri` = `GOOGLE_REDIRECT_URI` or `${origin}/api/v1/auth/google/callback`.
- **`GET /api/v1/auth/google/callback`** (NEW): verify `state` vs cookie → exchange `code` at `https://oauth2.googleapis.com/token` → verify `id_token` via Google JWKS (`createRemoteJWKSet`, `jwtVerify` with `issuer` ∈ {accounts.google.com, https://accounts.google.com}, `audience` = client id) → require `email_verified` → `findOrCreateOAuthUser({ email })` → `createAuthSession` + cookies → 302 `/`. On any failure → 302 `/?auth_error=google`.
- **Button**: "Continue with Google" → `window.location.href = '/api/v1/auth/google'`.
- **`?auth_error=` handling**: app-shell mount reads it, toasts a clear message, strips the param from the URL.

**`findOrCreateOAuthUser(prisma, { email, username? })`** (in `@wc/auth`): find by email → return if exists (link). Else create in one tx: `user` with `passwordHash = bcrypt(randomHex)` (unusable; user can set one via forgot-password) + GLOBAL wallet (1000) + SIGNUP ledger — mirrors `registerUser`. `username` omitted on OAuth create (nullable).

## 3. Files

| File | Change |
|------|--------|
| `packages/auth/src/auth-service.ts` | NEW `findOrCreateOAuthUser`, `createAuthSession`, `rotateRefresh`, `revokeSession` (DB logic; integration-testable) |
| `apps/web/lib/session.ts` | dual-token: `createSession(prisma,user,{ip,ua})` writes AuthSession + 2 cookies; `clearSession(prisma)` revokes + clears; keep `getSessionUser`/`requireAdmin` |
| `apps/web/app/api/v1/auth/login/route.ts` | pass prisma + ip/ua to `createSession` |
| `apps/web/app/api/v1/auth/register/route.ts` | same |
| `apps/web/app/api/v1/auth/logout/route.ts` | revoke session via `clearSession(prisma)` |
| `apps/web/app/api/v1/auth/refresh/route.ts` | NEW |
| `apps/web/app/api/v1/auth/google/route.ts` | NEW (start) |
| `apps/web/app/api/v1/auth/google/callback/route.ts` | NEW |
| `apps/web/lib/api.ts` | NEW `apiFetch` (401 → refresh → retry once) |
| `apps/web/components/app-shell.tsx` | bootstrap + `refreshUser` use `apiFetch`; `?auth_error=` toast |
| `apps/web/components/screens-core.tsx` | Google button real navigation |

## 4. Testing

- `@wc/auth` integration tests (test DB): `findOrCreateOAuthUser` create-vs-link; `createAuthSession`/`rotateRefresh`/`revokeSession`; reuse-detection revokes all.
- Web: `/api/v1/auth/refresh` happy path + reuse-detection (clears cookies, 401).
- e2e: existing signup/login stay green under dual-cookie; verify F5 persistence (reload keeps Home).
- Google callback: external dependency — verified manually once creds are in `.env`.

## 5. Known limitation

Component-level `fetch` calls outside app-shell do not auto-refresh on mid-session access expiry (1h). Acceptable: next navigation triggers `refreshUser` (which uses `apiFetch`) and re-syncs. A global fetch interceptor is out of scope unless requested.

## 6. Env (user-provided, not committed)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_REDIRECT_URI`. `JWT_SECRET` already used.
