# 核銷系統練習專案（範例 Repo）

> 從 Harness 專案模板建立的練習骨架：協作框架（AGENTS.md、Skills、閘門）加上 Node.js 後端、React 前端、PostgreSQL 資料庫。
> 上半部是這個專案怎麼跑起來；下半部是 Harness 框架的說明。

## 專案（未初始化）

第一次用 Claude Code 開啟這個資料夾時，會自動進入初始化引導（setup）。初始化完成後，這一段會換成專案名稱與一句話定位。

## 需要的工具

| 工具 | 版本 | 怎麼確認 |
|---|---|---|
| Node.js | 24.14.1 以上的 24 版，或 26 版（都是長期支援版 LTS） | `node -v` 印出 v24.14.1 以上的 v24，或 v26 開頭 |
| Docker Desktop | 最新版 | 打開 Docker Desktop，`docker ps` 印出 `CONTAINER ID` 開頭的標題列 |
| Git | 近期的版本 | `git --version` |
| python3 | 3.8 以上 | `python3 --version`（Harness 的閘門腳本要用） |
| make | 任何版本 | `make --version` |
| Claude Code | 公司開通的帳號 | 在專案資料夾輸入 `claude` |

- 先下載資料庫的映像檔，上課就不用等：`docker pull postgres:17-alpine`。
- Node.js 24.14.0 以前的版本附的 npm，會改寫 `package-lock.json`，`npm install` 之後 `git status` 就不乾淨。所以版本不對時，`npm install` 會直接停止（`EBADENGINE`）。已經裝了舊的 24，到 nodejs.org 下載最新的 24 LTS 重新安裝。
- Windows：
  - 指令在 Git Bash 打。下面「本機啟動」的六行在 PowerShell 也能打，但 `make` 一定要在 Git Bash 打。
  - Python 從 Microsoft Store 安裝，才會有 `python3` 指令；裝好在 Git Bash 打 `python3 --version` 確認。沒有 `python3` 的話，閘門讀不到內容，會默默放行。
  - make 沒有內建：在 PowerShell 執行 `winget install ezwinports.make`，關掉再重開 Git Bash。

## 目錄

產品程式碼在 `frontend/` 與 `backend/`（「無票不開發」閘門守的就是這兩個資料夾）。其他是 Harness 的框架檔，說明在下半部。

| 位置 | 內容 |
|---|---|
| `frontend/` | 畫面（React＋Vite）：首頁的健康狀態、測試帳號快速登入 |
| `backend/src/` | API（Express）：健康檢查 `/api/health`、登入 `/api/auth/*` |
| `backend/db/migrations/` | 資料庫結構的 Migration（`NNN_名稱.sql`，只新增） |
| `backend/db/seeds/` | 種子資料（`NN_名稱.sql`，Day 10 的 T1 建立） |
| `backend/test/` | API 測試（Vitest） |
| `docker-compose.yml` | 本機的練習資料庫（PostgreSQL 17） |
| `.env.example` | 環境變數範本 |

## 本機啟動

在專案資料夾，一行一行打（不要整段貼上）：

```bash
npm install                # 安裝套件
cp .env.example .env       # 準備環境變數，再打開 .env 填值
docker compose up -d db    # 用 Container 啟動練習資料庫（-d：在背景執行）
npm run db:migrate         # 建立資料表
npm run dev:api            # 啟動後端：http://localhost:4000
npm run dev:web            # 啟動前端：http://localhost:3000
```

- `.env` 只要自己填 `SESSION_SECRET`，其他值照範本。Mac 與 Git Bash 打 `openssl rand -hex 32`；PowerShell 打 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`。把印出的那串文字貼到 `SESSION_SECRET=` 的後面。`.env` 不可以提交，也不要貼給任何人。
- 資料庫第一次啟動要花幾秒準備：打 `docker compose ps`，STATUS 後面是 `(health: starting)` 就再打一次，等它變成 `(healthy)`，再執行 `npm run db:migrate`。太早執行會看到 `ECONNREFUSED` 或 `the database system is starting up`，等 10 秒再跑一次。
- 後端與前端各佔一個 Terminal 分頁，要一直開著；按 Control + C 停止。
  - 前端的程式（`frontend/`）存檔後，瀏覽器的畫面會自動更新，不用重新啟動。
  - 後端的程式（`backend/`）改了，要重新啟動後端，它不會自動重新載入。
  - `.env` 改了，後端與前端都不會自動重新讀：要重新啟動用到那個值的那一個（例如 `API_BASE_URL` 是前端在用），不確定就兩個都重新啟動。
- 後端只接受這台電腦自己的連線（只綁本機的 `127.0.0.1` 與 `::1`）：同一個網路的其他電腦或手機連不進來，所以快速登入不會被別人拿去用。
- Windows：上面六行在 PowerShell 與 Git Bash 都能直接打（`cp` 也可以）。

確認真的跑起來了：

| 層 | 怎麼檢查 | 正常的樣子 |
|---|---|---|
| 資料庫 | `docker compose ps` | db 是 `Up … (healthy)`，PORTS 是 `127.0.0.1:5432->5432/tcp` |
| 後端 | 打開 http://localhost:4000/api/health | `{"status":"ok","database":"ok"}` |
| 前端 | 打開 http://localhost:3000 | 「後端：正常」「資料庫：正常」 |
| 前後端串接 | DevTools 的 Network 面板 | `health` 請求的狀態碼是 200 |
| 整個專案 | `make check` | 最後一行 `[check] OK` |

### 3000 或 4000 被佔用時

- 4000 被佔用：在 `.env` 把 `API_PORT` 改成沒被佔用的埠（例如 4001），`API_BASE_URL` 一起改成 `http://localhost:4001`，後端與前端都重新啟動。
- 3000 被佔用：在 `.env` 加一行 `WEB_PORT=3001`（選填的變數，`.env.example` 裡沒有）。前端改用這個埠，後端也改成允許這個埠的前端呼叫；後端與前端都重新啟動，改開 http://localhost:3001。
- 開場簡報的健康檢查看的是 `scripts/framework-config.sh` 的 `HEALTH_URL`（全組共用）。只有你的電腦換埠時，不要改它，簡報的健康檢查會顯示失敗，知道原因就好。

## 資料庫指令

| 指令 | 做什麼 |
|---|---|
| `npm run db:migrate` | 照編號執行還沒跑過的 Migration（`backend/db/migrations/`）；每個環境記得自己跑到哪 |
| `npm run db:seed` | 放入種子資料（`backend/db/seeds/`）；可以重複執行，不會多出重複的資料 |
| `npm run db:reset` | 重建本機的資料庫：清空，從 000 起重跑全部 Migration，再放種子資料（只能在本機用，會刪掉本機資料庫的所有資料） |
| `npm run db:query -- "SELECT * FROM users;"` | 查看資料庫，結果印成表格（最多 200 列）；只能查、不能改，一次一個查詢 |

`db:query` 的「只能查、不能改」是真的擋得住，不只是約定：

- 只接受 `SELECT`、`WITH`、`TABLE`、`VALUES`、`EXPLAIN`、`SHOW` 開頭的一個查詢（註解不算開頭）。`COPY`、`DO`、`SET` 這類指令，還沒連資料庫就拒絕，印 `[query] 已拒絕：…`。
- 用只能讀的資料庫帳號 `claims_readonly` 執行。第一次執行時自動建立，密碼和 `DATABASE_URL` 的帳號相同。這個帳號只有讀取的權限，改不了資料，也不能在資料庫的主機上執行指令。
- 在唯讀的交易裡執行，最後一律還原（ROLLBACK）。

要改資料，一律寫成 Migration 或種子資料。

## 測試帳號與快速登入

- 登入頁（http://localhost:3000/login）的「測試帳號快速登入」列出資料庫裡的帳號，點一個人就以他的身分登入，不用密碼。只在開發環境與 Staging 開啟，正式環境會關閉。
- 六個測試帳號照 `docs/test-accounts.md`，Day 10 的 T1 用種子資料建立；在那之前，登入頁會顯示「還沒有任何帳號」。
- 在 Postman 帶登入身分：送 `POST http://localhost:4000/api/auth/test-login`，body 是 `{"email":"chen.zhiming@qingguang.example","cookie":false}`，回應裡的 `token` 放進之後請求的 Header：`Authorization: Bearer <token>`。登出（`POST /api/auth/logout`）之後，這個 Token 就失效。Token 和密碼一樣，不要貼到文件或群組。

## 檢查

```bash
make check
```

依序跑：票務檢查（ticket-lint）→ 程式風格（`npm run lint`）→ 型別（`npm run typecheck`）→ 測試（`npm test`）→ 正式版打包（`npm run build`），全部通過最後一行印 `[check] OK`。測試會連本機資料庫（自動建立並使用 `claims_test`，不動你的練習資料），所以要先 `docker compose up -d db`。

## 常見錯誤

| 訊息裡的關鍵字 | 意思 | 怎麼辦 |
|---|---|---|
| `command not found`（例如 `docker`、`node`） | 電腦找不到這個工具 | 確認已經安裝；裝完要重開 Terminal |
| `Cannot connect to the Docker daemon` | Container 工具沒有在執行 | 打開 Docker Desktop，等它啟動完成 |
| `ECONNREFUSED`，後面接著 `:5432` | 連不上資料庫：那個位址和埠沒有程式在接聽 | 用 `docker compose ps` 看資料庫有沒有在跑；沒有就啟動它，再重新啟動後端 |
| 剛啟動資料庫就建立資料表，出現 `ECONNREFUSED` 或 `the database system is starting up` | 資料庫還在準備，還不能連線 | 等 10 秒，再執行一次 `npm run db:migrate` |
| `port is already allocated`（啟動資料庫時） | 5432 埠已經被別的資料庫或 Container 佔用 | 用 `docker ps` 看是不是另一個 Container，是的話用 `docker stop 名稱` 停掉再啟動；不是的話，可能是電腦上另外裝的資料庫，請技術導師協助。不要用 `docker compose down -v` 重來，它會刪掉資料 |
| `缺少環境變數 SESSION_SECRET，請參考 .env.example` | `.env` 不存在，或少了這個值（空值也算缺少） | 對照 `.env.example` 補上，再重新啟動後端 |
| `EADDRINUSE` 或 `address already in use` | 這個埠已經被別的程式佔用 | 找到並關掉另一個還在跑的程式（常常是忘了關的舊分頁），Mac 可以用 `lsof -i :4000` 查是誰；或照上面「3000 或 4000 被佔用時」換埠 |
| `Cannot find module`、`tsx: command not found` | 套件沒有安裝 | 執行 `npm install` |
| `EBADENGINE`、`Unsupported engine`（執行 `npm install` 時） | Node.js 的版本不對：要 24.14.1 以上的 24 版，或 26 版 | 照「需要的工具」重新安裝 Node.js，關掉再重開 Terminal，`node -v` 確認版本，再執行一次 `npm install` |
| `relation ... does not exist` | 資料表還沒建立 | 執行 `npm run db:migrate` |
| 首頁顯示「後端：無法連線」 | 前端連不到後端 | 看後端的分頁有沒有在跑、有沒有錯誤；看 Network 面板的請求網址對不對 |
| 首頁顯示「資料庫：異常」 | 後端還在，但連不上資料庫 | `docker compose ps` 看 db 是不是 Up；停了就 `docker compose start db` |

---

## Harness 協作框架

> 給「用 AI Agent 開發軟體」的個人與小團隊：一套**角色入口 + 功能票 + 機制化閘門**的
> 協作框架，讓不懂 code 的案主/PM 和工程師共用同一個 repo、同一套規則，
> 而且規則靠 hook 強制執行，不靠自律。

### 這個框架解決什麼問題

VibeCoding 常見的坑：agent 假設需求就動工、改 A 壞 B 沒人發現、「能跑」就當「能上線」、
討論結論散落對話裡下次全忘。本框架的對策：

| 機制 | 對策 |
|------|------|
| **無票不開發**（hook 強制） | 沒有確認過「誰用/目的/驗收/邊界」的功能票，產品程式碼直接改不動 |
| **SPEC 單一事實來源** | 系統現在做什麼全記在 `docs/SPEC.md`，動工前先讀、改完必同步 |
| **角色入口** | 案主走 pm（全程白話）、工程師走 dev（工程語言），能力相同、守門相同 |
| **每次變更留痕** | 框架規則變更記 `docs/FRAMEWORK.md`（帶版號），功能變更記票與 SPEC |
| **開場簡報**（hook 強制） | 每個新對話自動報告專案現況，不用問「上次做到哪」 |

### 快速開始

1. **取得模板**：在 GitHub 按「Use this template」建立自己的 Repo，再 Clone 下來，作為你的專案根目錄。
2. **用 [Claude Code](https://claude.com/claude-code) 開啟**（桌面 app 或 CLI 皆可）。
3. **打任何字**——第一個對話會自動進入**初始化引導**：回答 5 組問題
   （專案名稱、技術棧、程式碼目錄、票號前綴、檢查指令），agent 會代你填好所有設定。
   答不出來的都可以跳過，之後再補。
4. 初始化完成後，每個新對話自動出現**專案現況簡報**與入口選項；
   直接說你要做的第一個功能即可。

> 不用 Claude Code 的 agent（Codex / Cursor）也能用：規則都在 `AGENTS.md` 與
> `.agents/skills/`，但 hooks（票務閘門、開場簡報）僅在 Claude Code 生效，其他 agent 靠紀律遵守。

### 開發協作流程

```
新對話開始
   │
   ▼
[team-leader] 專案現況簡報（SPEC 狀態 / ticket 看板 / 分支環境）
   │
   ├─→ [pm]        非工程師入口：討論需求（必問誰用/目的/驗收/邊界）→ 開票 →
   │                （要的話）agent 主導白話開發 → 實機測試 → 驗收
   │
   ├─→ [dev]       工程師入口：無票不開發 → 衝突/資安檢查 → 實作 → 驗證 → 推進票況
   │
   └─→ [framework] 框架入口：改協作框架本身（豁免票，必留決策紀錄）
```

pm 與 dev **能力相同**（都先開票、共用「分支與出貨流程」），差在使用者是誰與呈現方式。
完整規則與設計理由見 [docs/FRAMEWORK.md](docs/FRAMEWORK.md)。

### 框架的檔案

| 位置 | 進 git | 角色 |
|------|:------:|------|
| `AGENTS.md` | ✅ | 唯一工程契約（所有 agent 動工前先讀） |
| `CLAUDE.md` | ✅ | Claude Code 入口行為與路由 |
| `.agents/skills/` | ✅ | 角色入口與工作流的 canonical（單一來源） |
| `.claude/skills/` | ✅ | Claude Code adapter，只指回 canonical |
| `.claude/settings.json` | ✅ | hooks（開場簡報、票務閘門、git 同步閘門）與權限 |
| `tickets/` | ✅ | 功能票（產品開發唯一依據） |
| `docs/SPEC.md` | ✅ | 產品「目前實際行為」單一事實來源 |
| `docs/FRAMEWORK.md` | ✅ | 框架設計與決策紀錄（帶版號） |
| `docs/harness/` | ✅ | agent 派工制度（門檻、模板、判準） |
| `scripts/` | ✅ | 框架腳本（簡報、閘門、lint；專案設定在 `framework-config.sh`） |
| `cache/` | ❌ | 戰情資料（討論過程、demo 素材），可隨時丟棄 |
| `.env` | ❌ | 每個人自己的環境變數與 Secrets（只有 `.env.example` 進 git） |

### 框架規則 30 秒版

1. 新 session 先 team-leader 簡報 → 選入口，無例外。
2. 無票不開發（hook 強制）；PM 開票必問「誰用 / 目的 / 驗收 / 邊界」；
   開票用 `make new-ticket`（先 fetch 遠端再取號，防撞號）。
3. 票三態：待開發 → 開發中 → 完成（作廢不刪檔）；動工＝領票（標「開發中」＋填 `owner`，
   他人開發中的票不碰）。
4. 兩道確認閘：開票後問「現在開發嗎？」、綠燈後問「上實機嗎？」——授權單次有效，不跨票延續。
5. 功能改了，`docs/SPEC.md` 同一次變更同步，否則不算完成。
6. 框架變更豁免票，但必 bump 版號＋寫 `docs/FRAMEWORK.md` 決策紀錄。
7. 對外/不可逆動作（merge 整合分支、部署、刪資料）一律先問使用者。
8. push 前先 `git pull --rebase`（hook 強制），避免平行開發互相覆蓋。

### 來歷

本框架萃取自一個真實外包專案的協作制度（框架版本演進與每條規則的「為什麼」
完整保留在 [docs/FRAMEWORK.md](docs/FRAMEWORK.md) 決策紀錄與 [docs/harness/](docs/harness/) 案例）。
