# Staging：開通、部署、回滾

Staging 是線上的測試環境：別人（老師、客戶）打開網址就能試用，資料全部是測試資料。這個練習專案的 Staging 用兩個免費服務：

| 服務 | 放什麼 | 網址 |
|---|---|---|
| Render | 網站（後端加打包好的前端） | https://render.com |
| Neon | 資料庫（PostgreSQL 17） | https://neon.com |

兩個都用 GitHub 帳號登入，免費方案不用信用卡。每個人用自己的帳號、自己的資料庫，彼此不會互相影響。

- 開通是 Day 10 晚上的作業，大約 20 分鐘；Day 12 部署與回滾都在這裡做。
- 資料庫的連線字串（`postgresql://` 開頭那一串）裡有密碼：只貼進 Render 的環境變數，不要貼到 Agent 的對話、文件、截圖或群組。
- Staging 是公開的網址，又有測試帳號快速登入，拿到網址的人都能登入：只放虛構的測試資料。

## 1. 開通（Day 10 晚上，約 20 分鐘）

### 1-1. Neon：建立資料庫

1. 到 https://neon.com ，用 GitHub 登入。
2. 按 New Project，照下表填，按 Create：

   | 欄位 | 填什麼 |
   |---|---|
   | Project name | `claims-staging` |
   | Postgres version | 17 |
   | Region | AWS Asia Pacific（Singapore） |
   | Database name | `claims`（表單上沒有這一欄的話，建好之後到 Databases → New Database 建一個 `claims`） |

3. 按 Connect，連線方式選直接連線（把 Connection pooling 關掉），資料庫選 `claims`。
4. 複製連線字串：長得像 `postgresql://帳號:密碼@ep-xxxx.ap-southeast-1.aws.neon.tech/claims?sslmode=require&channel_binding=require`。下一步直接貼進 Render，不要存在別的地方。

### 1-2. Render：建立網站服務

1. 到 https://render.com ，用 GitHub 登入。
2. 第一次要安裝 Render 的 GitHub App：選 Only select repositories，只勾你自己的練習 Repo（`claims-mvp-你的英文名`）。不要給它所有 Repo 的權限。
3. 按 New → Web Service，選你的練習 Repo，照下表填：

   | 欄位 | 填什麼 |
   |---|---|
   | Name | `claims-你的英文名`（網址會是 `https://claims-你的英文名.onrender.com`） |
   | Region | Singapore |
   | Branch | `stage` |
   | Build Command | `npm run staging:build` |
   | Start Command | `npm run staging:start` |
   | Instance Type | Free |

4. Environment Variables：加四個（名稱照 `.env.example`，再加 `APP_ENV`）：

   | 名稱 | 值 |
   |---|---|
   | `DATABASE_URL` | 貼上 Neon 的連線字串 |
   | `SESSION_SECRET` | 按 Generate，讓 Render 產生 |
   | `API_BASE_URL` | `https://claims-你的英文名.onrender.com`（Render 在網址加了尾碼的話，建立後照實際網址改） |
   | `APP_ENV` | `staging` |

   `.env.example` 裡的 `API_PORT` 不用設：Render 會自己給埠號（`PORT`）。

5. Advanced：
   - Health Check Path 填 `/api/health`。Render 會等新版的健康檢查通過才切換過去；沒通過就留在舊版。
   - Auto-Deploy 選 Off：合併進 `stage` 不會自己部署，要有人按部署。
6. 按 Create Web Service。

### 1-3. 確認

建立之後，Render 會先部署一次 `stage`（大約 2–5 分鐘），部署的輸出在服務頁面的 Events，點那一次部署就看得到。

1. 打開 `https://claims-你的英文名.onrender.com/api/health`，看到 `"status":"ok"`、`"database":"ok"` 與 `version` 就完成了。
2. 打開網站的登入頁：有六個人，代表種子資料已經放進去。T1 還沒合併的人，登入頁會顯示「還沒有任何帳號」，Day 12 部署含 T1 的版本時才會放入。
3. Day 11 09:30 技術導師會抽查每個人的 `/api/health`。

API_BASE_URL 打錯、或 Render 實際的網址有尾碼：到 Environment 改成實際的網址，按 Save and deploy。

## 2. Day 11 改用起點版本的人

起點版本是另一個 Repo（`claims-start-你的英文名`），兩份的 Migration 不一樣，資料庫也要重建。Day 11 13:00 技術導師會協助：

1. GitHub → Settings → Applications → Render → Configure，在 Only select repositories 加上 `claims-start-你的英文名`。
2. Render → 你的服務 → Settings，在 Build & Deploy 把 Repository 改成 `claims-start-你的英文名`，Branch 一樣是 `stage`。
3. Neon → 你的專案 → Databases：刪掉 `claims`，再建立一個同名的 `claims`（舊的資料表接不上起點版本的 Migration）。
4. Render → Manual Deploy → Deploy latest commit，確認 `/api/health` 是 ok。

## 3. 部署、回滾與查詢（Day 12 用）

| 要做的事 | 在哪裡 |
|---|---|
| 部署 | Render → 你的服務 → Manual Deploy → Deploy latest commit。只部署已經合併進 `stage` 的版本 |
| 看部署過程的輸出 | Render → Events，點那一次部署（下面有輸出的範例） |
| CI 的結果 | GitHub 的 Actions；PR 頁面下方也看得到（`make check`） |
| Migration | 部署時自動執行還沒跑過的 |
| 種子資料 | 部署時，資料庫還沒有任何帳號才自動放入 |
| 環境變數 | Render → Environment。只有你看得到、改得到；值預設遮住，不要按顯示。改完選 Save and deploy，重新部署後才生效 |
| Log | Render → Logs：可以選時間範圍，搜尋 `ERROR` 或 request id（`req=` 後面那 4 碼） |
| 備份資料庫 | Neon → 你的專案 → Branches → Create branch：從 `production` 的「現在」建立，名稱用 `staging-年月日-時分`（例如 `staging-20261119-1312`）。要還原時請技術導師用 Neon 的 Restore |
| 線上是哪一版 | 頁尾右下角的「版本」、`/api/health` 回應裡的 `version`、Render Events 最上面那一次部署的 Commit |
| 健康檢查 | `https://claims-你的英文名.onrender.com/api/health` |
| 回滾 | Render → Events → 找到回滾目標那一版 → Rollback → Rollback to this deploy。直接用那一版打包好的檔案，不重新打包，大約 1 分鐘；免費方案只能回到最近兩次部署 |
| 分支與環境 | `feature/*` 不部署；`stage` 部署到你自己的 Staging；這門課沒有正式環境，不建立 `prod` |
| 快速登入 | `APP_ENV` 是 `development` 或 `staging` 時開啟，`production` 時關閉 |

部署輸出的範例（中間會穿插 Render 自己的訊息）：

```text
[deploy] 部署 9e3b6d0 到 Staging
[deploy] 安裝套件……完成
[deploy] 打包……完成
[deploy] 執行 Migration：005_add_receipt_photo……完成
[deploy] 種子資料：已經有帳號，略過
[deploy] 啟動新版 9e3b6d0，Render 健康檢查通過後才會切換
2026-11-19T14:41:07.882+08:00 INFO  server started version=9e3b6d0 port=10000 database=ep-xxxx.ap-southeast-1.aws.neon.tech/claims
```

- 沒有新的 Migration 時，那一行是 `[deploy] 沒有新的 Migration`。
- `server started` 那一行的 `database=主機/資料庫`，是用來核對「連到的是不是自己的 Neon、資料庫是不是 `claims`」，不用打開 `DATABASE_URL` 的值。
- 回滾到舊版時會多一行「資料庫已經執行過 005_…，這一版的程式沒有這個檔（可能是回滾到舊版），略過」：Migration 只新增，舊版照常啟動。
- 打包失敗時會印 `[deploy] 打包失敗：線上還是上一版`；少了必填的環境變數，啟動時會印 `ERROR startup failed: missing required environment variable …`。兩種情況 Render 都會留在舊版。

## 4. 常見狀況

| 狀況 | 原因 | 怎麼辦 |
|---|---|---|
| 打開網址要等快 1 分鐘才有畫面 | 免費方案閒置 15 分鐘會休眠，第一個請求要等它醒來 | 等它醒來；要給別人試用前，自己先打開一次 |
| 網站打得開，首頁顯示「後端：無法連線」 | `API_BASE_URL` 還是 `localhost`，瀏覽器去連使用者自己的電腦 | Environment 改成 Staging 的網址，Save and deploy |
| `/api/health` 回 503、`"database":"error"` | 連不上 Neon：`DATABASE_URL` 貼錯，或選成了 pooling 的連線字串 | 回 Neon 重新複製直接連線的字串，更新 Environment |
| 部署失敗，Logs 有 `missing required environment variable` | 少設了環境變數，或值是空的 | 對照 `.env.example` 補上，再部署 |
| Postman 對 Staging 一直回 401 | 用了本機的登入資訊 | 換成 `staging` 環境後，重送一次「00 登入」（見 `postman/README.md`） |
| 登入頁顯示「還沒有任何帳號」 | 部署的版本還沒有種子資料（T1 還沒合併） | 合併 T1 之後再部署一次 |
