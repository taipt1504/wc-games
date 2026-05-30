# 13 — Sequence Diagrams

12 sơ đồ tuần tự (mermaid) cho các luồng then chốt. Render được trên GitHub/VS Code (mermaid).

---

## SEQ-01 — Đăng ký / Đăng nhập (JWT + cookie, thu thập IP/UA)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Web (PWA)
    participant API as Auth Service
    participant DB as Database
    U->>FE: Nhập email + mật khẩu
    FE->>API: POST /auth/register hoặc /login (kèm IP, User-Agent)
    API->>API: Validate + hash/verify mật khẩu
    alt Đăng ký mới
        API->>DB: Tạo user + cộng 1000 point (ledger SIGNUP_BONUS)
    end
    API->>DB: Lưu AuthSession + AuditLog (IP, UA, time)
    API-->>FE: Set-Cookie JWT (httpOnly, Secure) + refresh token
    FE-->>U: Vào app / onboarding
    Note over API,DB: Sai mật khẩu N lần -> rate-limit / captcha
```

## SEQ-02 — Điểm danh hằng ngày (+200, streak)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Web
    participant API as Point Service
    participant DB as Database
    U->>FE: Bấm "Điểm danh"
    FE->>API: POST /checkin
    API->>DB: Kiểm tra đã điểm danh hôm nay?
    alt Chưa điểm danh
        API->>API: Tính thưởng theo bậc streak
        API->>DB: +point (ledger DAILY_CHECKIN) + streak++
        API-->>FE: Thành công + số point + streak
    else Đã điểm danh
        API-->>FE: Từ chối + mốc reset kế tiếp
    end
```

## SEQ-03 — Đặt kèo 1X2 + khoá tại kickoff

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Web
    participant API as Prediction Service
    participant DB as Database
    participant SCH as Scheduler
    U->>FE: Chọn trận, cửa (1/X/2), nhập stake S
    FE->>API: POST /predictions (match, outcome, S)
    API->>DB: Kiểm tra trận chưa kickoff + đủ số dư
    alt Hợp lệ
        API->>DB: Trừ S (escrow) + tạo Prediction OPEN + snapshot odds
        API-->>FE: Xác nhận + payout dự kiến
    else Đã kickoff / thiếu số dư
        API-->>FE: Từ chối
    end
    Note over SCH,DB: Tới giờ kickoff
    SCH->>DB: Chuyển mọi Prediction OPEN -> LOCKED
```

## SEQ-04 — Settle trận & chia điểm

```mermaid
sequenceDiagram
    participant PIPE as Data Pipeline
    participant API as Settlement Service
    participant DB as Database
    participant LB as Leaderboard Service
    participant ADM as Admin
    PIPE->>API: Trận FINISHED + tỉ số 90'
    API->>API: Xác định result_90 (1/X/2) + score_90
    alt Nguồn đáng tin / khớp
        API->>DB: Tính payout từng kèo (1X2 + bonus knockout), idempotent theo match_id
        API->>DB: Cập nhật ví + ledger SETTLE (WON/LOST)
        API->>LB: Trigger cập nhật leaderboard
    else Nguồn mâu thuẫn
        API->>ADM: Treo settle, chờ xác nhận
        ADM->>API: Confirm tỉ số đúng
        API->>DB: Tiến hành settle
    end
    Note over API,DB: Trận huỷ -> VOID, hoàn stake
```

## SEQ-05 — Tạo lobby + mời + tham gia

```mermaid
sequenceDiagram
    actor H as Chủ phòng
    actor M as Thành viên
    participant FE as Web
    participant API as Lobby Service
    participant DB as Database
    H->>FE: Cấu hình (mật khẩu, default, scope vòng)
    FE->>API: POST /lobbies
    API->>DB: Tạo lobby + invite token
    API-->>H: Invite link + mật khẩu
    H->>M: Gửi link (Slack/Zalo)
    M->>FE: Mở link + nhập mật khẩu
    FE->>API: POST /lobbies/{id}/join
    API->>DB: Kiểm tra hợp lệ -> tạo membership + cấp default (ledger LOBBY_DEFAULT)
    API-->>M: Vào phòng + số dư lobby
```

## SEQ-06 — Mượn point + duyệt

```mermaid
sequenceDiagram
    actor M as Thành viên
    actor H as Chủ phòng
    participant API as Lobby Service
    participant DB as Database
    participant NTF as Notification
    M->>API: POST /lobbies/{id}/borrow (B point)
    API->>DB: Tạo BorrowRequest PENDING
    API->>NTF: Báo chủ phòng
    NTF-->>H: "M xin mượn B point"
    alt Approve
        H->>API: Approve
        API->>DB: borrowed += B + ledger BORROW + cấp khả năng đặt kèo
        API-->>M: Đã có B (score_lobby -= B)
    else Deny
        H->>API: Deny
        API-->>M: Bị từ chối
    end
    Note over H,API: Hoặc chủ phòng set point mượn trực tiếp
```

## SEQ-07 — AI ingest dữ liệu (sports API + 9router fallback)

```mermaid
sequenceDiagram
    participant CRON as Scheduler
    participant ING as Ingest Worker
    participant SAPI as Sports Data API
    participant RT as 9router (proxy)
    participant CLA as Claude (Anthropic)
    participant OAI as OpenAI
    participant DB as Database
    CRON->>ING: Trigger job ingest
    ING->>SAPI: GET fixtures/scores/squads/standings
    SAPI-->>ING: Dữ liệu có cấu trúc
    ING->>DB: Upsert (nguồn = API)
    opt Cần chuẩn hoá / trích xuất phi cấu trúc
        ING->>RT: Yêu cầu LLM (OpenAI-compatible)
        RT->>CLA: Route primary (Claude)
        alt Claude OK
            CLA-->>RT: Kết quả
        else Claude lỗi/hết quota
            RT->>OAI: Fallback (OpenAI)
            OAI-->>RT: Kết quả
        end
        RT-->>ING: Kết quả (đã dịch format)
        ING->>DB: Lưu dữ liệu chuẩn hoá + log AIJob
    end
```

## SEQ-08 — AI sinh tin tức + review queue

```mermaid
sequenceDiagram
    participant CRON as Scheduler
    participant NW as News Worker
    participant SRC as Nguồn tin (whitelist)
    participant RT as 9router
    participant DB as Database
    actor ADM as Admin
    participant PUB as Trang tin
    CRON->>NW: Trigger sinh tin
    NW->>SRC: Thu thập bài nguồn
    NW->>RT: Tóm tắt/viết lại (Claude -> fallback OpenAI)
    RT-->>NW: Bản nháp + tag
    NW->>DB: Lưu NewsArticle PENDING (kèm nguồn)
    ADM->>DB: Mở review queue
    alt Duyệt
        ADM->>DB: PUBLISHED
        DB-->>PUB: Hiển thị công khai
    else Từ chối
        ADM->>DB: REJECTED + lý do
    end
```

## SEQ-09 — Tổng hợp tỉ lệ kèo (odds)

```mermaid
sequenceDiagram
    participant CRON as Scheduler
    participant ODW as Odds Worker
    participant SITES as Trang dự đoán nổi tiếng
    participant RT as 9router
    participant DB as Database
    actor ADM as Admin
    CRON->>ODW: Trigger tổng hợp odds
    ODW->>SITES: Thu thập tỉ lệ (nhiều nguồn)
    ODW->>RT: Trích xuất + chuẩn hoá về m_home/m_draw/m_away
    RT-->>ODW: Odds chuẩn hoá
    ODW->>DB: Upsert MatchOdds (nguồn = AI)
    opt Admin / chủ lobby override
        ADM->>DB: Set tỉ lệ thủ công (ưu tiên cao hơn)
    end
    Note over DB: Kèo đã đặt dùng odds snapshot tại thời điểm đặt
```

## SEQ-10 — Nộp Bracket + chấm điểm

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Web
    participant API as Bracket Service
    participant DB as Database
    participant SET as Settlement
    Note over DB: Sau vòng bảng -> xác định 32 đội
    U->>FE: Điền nhánh knockout (đội đi tiếp tới CK)
    FE->>API: POST /bracket
    API->>DB: Lưu Bracket (khoá tại kickoff knockout đầu)
    loop Mỗi vòng knockout settle
        SET->>API: Đội X đã đi tiếp
        API->>DB: Cộng điểm cho user đoán đúng X (lũy tiến theo vòng)
        API->>DB: Cập nhật leaderboard bracket
    end
```

## SEQ-11 — Cập nhật Leaderboard

```mermaid
sequenceDiagram
    participant SET as Settlement
    participant LB as Leaderboard Service
    participant CACHE as Cache
    participant DB as Database
    actor U as User
    SET->>LB: Sự kiện settle xong (global + lobby liên quan)
    LB->>DB: Tính lại điểm/thứ hạng (global + từng lobby)
    LB->>CACHE: Ghi snapshot xếp hạng (phân trang)
    U->>LB: GET /leaderboard
    LB->>CACHE: Đọc snapshot
    LB-->>U: Bảng xếp hạng + thứ hạng bản thân
    Note over LB,CACHE: Chịu spike sau giờ settle -> đọc từ cache
```

## SEQ-12 — Admin gắn cờ & xử lý lobby nghi vấn

```mermaid
sequenceDiagram
    participant RISK as Risk Engine
    participant DB as Database
    actor ADM as Admin
    participant CASE as Case File
    RISK->>DB: Quét heuristic (mượn bất thường, chung IP/UA, dòng point 1 chiều)
    RISK->>DB: Gắn cờ lobby + đẩy review queue
    ADM->>DB: Mở điều tra (ledger, IP/UA, chat)
    alt Xác nhận vi phạm
        ADM->>DB: Đóng lobby + ban user liên quan
        ADM->>CASE: Tạo case file + export bằng chứng
        ADM->>DB: Ghi AuditLog
    else Không vi phạm
        ADM->>DB: Gỡ cờ + ghi chú
    end
```
