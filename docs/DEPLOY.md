# Hướng dẫn Deploy — WC Game (FIFA World Cup 2026 prediction game)

> Monorepo pnpm: **`apps/web`** (Next.js 15 — player + admin), **`apps/worker`** (NestJS + BullMQ — settle/news/live/lineup/football-data sync), **Postgres** (Prisma), **Redis** (BullMQ + realtime pub/sub). Provider dữ liệu giải: **football-data.org API v4**. LLM gateway (9router) tùy chọn cho lineup AI + news.

Mọi lệnh chạy từ **gốc repo** trừ khi ghi rõ. Tài liệu này bám sát `package.json`, `docker-compose.yml`, `.env.example` thực tế của repo.

---

## 1. Yêu cầu (Prerequisites)

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | **≥ 22** (`engines.node`) | CI dùng 22. Node 20 chạy được nhưng in warning. |
| pnpm | **9.12.0** (`packageManager`) | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| PostgreSQL | **16** | Local: container `postgres:16-alpine`. Prod: managed PG. |
| Redis | **7** (có password) | Local: container `redis:7-alpine`. Prod: managed Redis (BullMQ cần). |
| football-data.org API key | — | Đăng ký free tại football-data.org. **Free tier = 10 request/phút.** Tùy chọn nhưng **bắt buộc nếu muốn dữ liệu giải thật**. |
| LLM gateway (9router) | — | Tùy chọn — chỉ cần cho AI lineup-crawl + news. App có fallback khi trống. |

---

## 2. Biến môi trường (`.env`)

`.env.example` **chính là template prod**. Copy và điền:

```bash
cp .env.example .env
```

Cả `apps/web` (`next.config.mjs`) và `apps/worker` (`main.ts`) đều load **`.env` ở gốc repo**. Một file `.env` duy nhất cho toàn monorepo.

### Bắt buộc trong prod (đánh dấu ⚠️ trong file)

| Var | Ví dụ | Ghi chú |
|---|---|---|
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/wc_game?schema=public` | Postgres thật. |
| `REDIS_URL` | `redis://:PASSWORD@HOST:6379` | **Phải khớp password Redis.** ACL user: `redis://USER:PASS@HOST:6379`. TLS: `rediss://…`. URL-encode ký tự đặc biệt. |
| `JWT_SECRET` | `openssl rand -base64 48` | Sinh secret ngẫu nhiên mạnh. |

### football-data.org (để có dữ liệu giải thật)

```dotenv
SPORTS_API_BASE_URL=https://api.football-data.org/v4
SPORTS_API_KEY=<API key của bạn>
```

> ⚠️ **Lưu ý sửa `.env` đúng cách:** điền giá trị vào **đúng dòng có sẵn** `SPORTS_API_KEY=` / `SPORTS_API_BASE_URL=` — đừng thêm dòng trùng. `.env` có dòng `KEY=` trùng lặp sẽ làm dotenv lấy nhầm giá trị rỗng và worker/route sync sẽ báo `NO_API_KEY`.

### Tùy chọn (app có fallback khi trống)

- `LLM_GATEWAY_BASE_URL` / `LLM_GATEWAY_API_KEY` / `LLM_MODEL_PRIMARY` / `LLM_MODEL_FALLBACK` — AI lineup + news.
- `ODDS_API_*` — odds provider (hiện dùng house odds nội bộ).
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `SMTP_URL` — web push + email.
- `S3_*` — share card / asset storage.
- Scoring config: `SIGNUP_BONUS=1000`, `DAILY_CHECKIN=200`, `MIN_STAKE=1`, `KNOCKOUT_BONUS_RATE`, `UNDERDOG_THRESHOLD`, `LEADERBOARD_MIN_SETTLED`, `TIMEZONE=Asia/Ho_Chi_Minh`.
- Web: `WEB_PORT=3000`, `APP_BASE_URL`. Auth: `ACCESS_TTL=15m`, `REFRESH_TTL=30d`, `RATE_LIMIT_*`.

> **KHÔNG** set `TEST_DATABASE_URL` trong `.env`. Integration test (`*.int.test.ts`) wipe bảng; `@wc/db` chặn chạy trừ khi `DATABASE_URL === TEST_DATABASE_URL`. Chạy int-test bằng cách override cả hai inline trỏ tới **DB test riêng** (không bao giờ trỏ dev/prod DB).

---

## 3. Hạ tầng local (Docker Compose)

`docker-compose.yml` cung cấp Postgres + Redis:

```bash
# Redis password mặc định = wc_redis123 (override qua REDIS_PASSWORD)
pnpm docker:up      # = docker compose up -d
pnpm docker:down    # = docker compose down
```

- **Postgres**: `wc:wc@localhost:5432/wc_game` → `DATABASE_URL=postgresql://wc:wc@localhost:5432/wc_game?schema=public`
- **Redis**: password `wc_redis123` → `REDIS_URL=redis://:wc_redis123@localhost:6379`

Đổi password Redis: set `REDIS_PASSWORD` (compose dùng) **và** cập nhật `REDIS_URL` cho khớp.

Prod: thường dùng managed PG/Redis thay vì compose — chỉ cần `DATABASE_URL`/`REDIS_URL` trỏ đúng + Redis bật password/TLS.

---

## 4. Quy trình deploy production

```bash
# 0. Env
cp .env.example .env          # điền DATABASE_URL / REDIS_URL / JWT_SECRET (+ SPORTS_API_* nếu dùng FD)

# 1. Cài + generate Prisma client + build @wc/db
pnpm install
pnpm db:generate              # = prisma generate
pnpm build                    # @wc/db build TRƯỚC, rồi build toàn bộ workspace (web + worker + packages)

# 2. Áp migration (tạo schema)
pnpm db:deploy                # = prisma migrate deploy — áp 9 migration theo thứ tự (0_init → … → add_scorer)

# 3. Nạp dữ liệu (xem Mục 5)
pnpm --filter @wc/pipeline ingest      # cấu trúc giải thật (worldcup26, keyless) — 48 đội, 104 trận
pnpm --filter @wc/pipeline ingest:fd   # overlay football-data: squad thật + giờ thật + externalId (cần SPORTS_API_KEY)

# 4. Chạy services (giữ chạy nền — pm2/systemd/container)
pnpm --filter @wc/web start            # Next production server (sau next build) — cổng 3000
pnpm --filter @wc/worker start         # NestJS worker (node dist/main.js) — cần Redis
```

### Build — thứ tự phụ thuộc (quan trọng)

Repo **không dùng Turbo**. `pnpm build` xử lý đúng thứ tự: `@wc/db` build trước (mọi package import `dist/` của nó), rồi `pnpm -r run build`.

> Nếu build/typecheck **một package lẻ** (vd `@wc/web`/`@wc/pipeline`) báo lỗi kiểu `Property 'x' does not exist`, thường do **dist của dependency cũ**. Build deps trước theo thứ tự: `@wc/db → @wc/realtime → @wc/ai → @wc/fixtures → @wc/pipeline → (web|worker)`. `pnpm build` ở gốc làm đúng việc này.

### Cổng web

`next start` mặc định cổng **3000** (không tự đọc `WEB_PORT`). Đổi cổng:

```bash
pnpm --filter @wc/web exec next start -p $WEB_PORT
```

### Worker

`node dist/main.js` — chạy nền (không có HTTP server), tiêu thụ BullMQ queue (settle, news, lineup, result-check) + timer poller (livescore, fd_sync) + MatchScheduler. **Bắt buộc** Redis. Thiếu `SPORTS_API_KEY` → các job FD tự `SKIP` (`no-key`), không crash.

---

## 5. Nạp dữ liệu (Data population)

Migration chỉ tạo **bảng rỗng**. Cần nạp dữ liệu giải. Các CLI (`packages/pipeline`):

| Lệnh | Nguồn | Tạo gì | Cần |
|---|---|---|---|
| `pnpm seed` | `@wc/fixtures` (tổng hợp) | 12 group, 48 đội, 72 trận group + odds | — (không mạng) |
| `pnpm --filter @wc/pipeline ingest` | worldcup26.ir (keyless) | 48 đội, **104 trận** (cả vòng knock-out), venue | mạng |
| `pnpm --filter @wc/pipeline ingest:fd` | **football-data.org** | squad thật (26 cầu thủ/đội) + HLV + giờ thi đấu thật + `externalId`; cập nhật tỉ số/trạng thái | `SPORTS_API_KEY` + `SPORTS_API_BASE_URL` |
| `pnpm --filter @wc/pipeline crawl-players [CODE…]` | LLM (9router) | đội hình AI: sơ đồ + XI đá chính + vị trí cụ thể + số áo | `LLM_GATEWAY_*` |

### Thứ tự khuyến nghị (dữ liệu thật)

```bash
pnpm db:deploy
pnpm --filter @wc/pipeline ingest        # 1) cấu trúc nền: đội + 104 trận (worldcup26)
pnpm --filter @wc/pipeline ingest:fd     # 2) overlay football-data (squad/giờ/externalId)
```

> **Vì sao theo thứ tự này:** `ingest:fd` **không tạo** trận mới — nó khớp dữ liệu FD vào hàng có sẵn theo `externalId`/natural-key (đội theo TLA/tên, trận GROUP theo cặp đội, knock-out theo thứ tự thời gian). Nên cần lớp nền (`seed` hoặc `ingest`) trước. `ingest:fd` chạy **teams trước** (set `Team.externalId`) rồi **matches** (resolve đội theo externalId) — CLI đã đảm bảo thứ tự này.

Nếu offline / chỉ demo: chỉ cần `pnpm seed` (không mạng, không key).

### Cập nhật liên tục sau khi live

- **Worker `fd_sync` job** tự sync teams/squads + matches + scorers theo cadence (config trong bảng `ScheduleJob`; mặc định mỗi 45 phút, teams mỗi 16 lần chạy).
- **Worker `livescore` job** poll `?status=LIVE` của football-data — **có window-gate**: chỉ gọi API khi có trận LIVE hoặc sắp đá (≤15 phút tới / đã đá ≤3h), tiết kiệm request ngoài khung giờ.
- **Admin UI** (đăng nhập ADMIN): nút **"Sync all squads (API)"** (đồng bộ toàn bộ squad từ FD), **"Sync squad (API)"** ở trang chi tiết đội, **"Sync matches"** (bulk match sync từ FD), và **"Sync result"** từng trận.

> **Thứ tự sau RESET_TOURNAMENT:** reset tạo lại đội **không có** `externalId`. Phải chạy **"Sync all squads (API)" trước**, rồi **"Sync matches"** — nếu không match sẽ không resolve được (không mất dữ liệu, chỉ là chưa khớp cho tới khi sync squad).

### Rate limit football-data

Free tier = **10 request/phút**. Client FD (`packages/pipeline/src/football-data.ts`) tự giới hạn ≤ **8/phút** (giãn 7.5s/request) + tôn trọng header `x-requests-available-minute` + backoff 429. **Frontend tuyệt đối không gọi FD trực tiếp** — mọi call qua worker/CLI/admin-route, cache vào DB, web đọc từ DB.

---

## 6. Tạo tài khoản Admin

Chưa có CLI tạo admin. Đăng ký user qua web rồi set role trong DB:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Role hợp lệ: `USER / MOD / ADMIN / OPS / SUPER`. Catalog (missions, cosmetics) tự seed lazily lần truy cập đầu — không cần seed thủ công.

---

## 7. Migrations

Thư mục `packages/db/prisma/migrations/` (áp theo thứ tự bởi `pnpm db:deploy`):

```
0_init                          # baseline — 44 bảng + enum
20260607015723_add_lineup_fields
20260607030514_bet_per_outcome
20260607034137_match_betting_locked
20260607060000_notification_read
20260607120000_schedule_job
20260607130000_news_i18n
20260609000000_add_external_ids # football-data id mapping (Team/Match/Player.externalId)
20260609010000_add_scorer       # bảng Scorer (Top Scorers / Golden Boot)
```

- **Prod luôn dùng `pnpm db:deploy`** (`prisma migrate deploy`) — chỉ áp migration pending, **không reset**, an toàn với dữ liệu thật.
- **Tránh `prisma migrate dev` trên DB có dữ liệu** — nó kiểm tra drift và **có thể reset** DB.
- Schema mới (dev): sửa `schema.prisma` → `pnpm db:migrate` (tạo migration) → commit → prod `pnpm db:deploy`.

---

## 8. Checklist sau deploy (smoke test)

1. `pnpm db:deploy` in `All migrations have been successfully applied.`
2. DB có dữ liệu: `Team`=48, `Match`=104 (sau `ingest`), `Scorer`=0 (rỗng tới khi giải bắt đầu — bình thường).
3. Web lên: mở `APP_BASE_URL` → trang chủ/lịch/bảng xếp hạng/top scorers render.
4. Worker log: `WC2026 worker started`. Nếu có `SPORTS_API_KEY`, `fd_sync` log `matches matched … scorers …`; nếu không, log `SKIPPED no-key`.
5. Sau khi set `SPORTS_API_KEY`: chạy `pnpm --filter @wc/pipeline ingest:fd` → `teams 48, players ~1248, matches matched ~98`.
6. Đăng nhập admin → "Sync all squads (API)" trả `teams X / players Y`.

---

## 9. Bảo mật

- `JWT_SECRET`: `openssl rand -base64 48`, không commit, không tái dùng giữa môi trường.
- Redis: luôn bật password (compose mặc định `wc_redis123` — **đổi trong prod**); cân nhắc TLS (`rediss://`).
- `SPORTS_API_KEY` / `LLM_GATEWAY_API_KEY`: quản lý qua secret manager, **rotate** nếu lộ.
- `.env` không vào git (đã gitignore). Quản lý secret prod qua môi trường/secret store, không file phẳng nếu tránh được.
- DB test-guard: không trỏ test DB vào `.env` dev/prod (xem Mục 2).

---

## 10. Vận hành & scheduled jobs

Worker chạy các job (registry: bảng `ScheduleJob`, chỉnh cadence/enable qua admin):

| Job | Việc | Nguồn |
|---|---|---|
| `fd_sync` | sync teams/squads + matches + scorers | football-data.org |
| `livescore` | poll tỉ số LIVE (có window-gate) | football-data.org `?status=LIVE` |
| `result_check` → `settle` | phát hiện FINISHED → settle điểm | DB (đã được livescore ghi) |
| `lineup` | crawl XI đá chính + sơ đồ (kickoff −15') | LLM (9router) — FD không có XI/số áo gần giờ đá |
| `news` | gen + auto-publish tin (EN/VI) | LLM + RSS |

Admin "Run now" trigger từng job qua `POST /api/v1/admin/schedule-jobs/[key]/trigger` (Redis pub/sub → worker).

> **Trong giải (từ 2026-06-11):** kiểm tra lại luồng live — chuyển trạng thái IN_PLAY → FINISHED + bảng Top Scorers đầy dần. Trước đó mọi trận là `TIMED` nên các luồng này chưa test được thực tế.

---

## 11. Troubleshooting

| Triệu chứng | Nguyên nhân / Khắc phục |
|---|---|
| Sync FD trả `NO_API_KEY` (503) hoặc job `SKIPPED no-key` | `SPORTS_API_KEY`/`SPORTS_API_BASE_URL` rỗng hoặc `.env` có dòng trùng. Điền đúng 1 dòng mỗi key. |
| `ingest:fd` báo `fetch failed` | Mạng chập / vượt rate-limit tạm thời. Thử lại; client tự giãn 8/phút. |
| Build lẻ lỗi `Property … does not exist on type` | Dist dependency cũ → `pnpm build` ở gốc (build đúng thứ tự) hoặc build deps trước. |
| Worker không xử lý gì | Thiếu/kết nối sai Redis (`REDIS_URL` không khớp password). |
| `ingest:fd` matches `unresolved > 0` hoặc team `unmatched` | TLA/tên DB ≠ FD (vd Uruguay `URU` vs `URY`). Đã có fallback theo tên; nếu vẫn lệch, ghi chú đội đó, không đoán. |
| Bracket play-off trống (TBD) | Đúng — chỉ điền khi có trận vòng bảng FINISHED. |

---

## 12. Tham chiếu

- `README.md` — quickstart + ghi chú migration.
- `docs/solution-design/2026-05-30-wc-game-solution-design.md` — kiến trúc hạ tầng (Dev/Staging/Prod).
- `docs/superpowers/specs/2026-06-09-football-data-integration-design.md` — thiết kế tích hợp football-data.org.
- `.env.example` — hợp đồng biến môi trường đầy đủ.
