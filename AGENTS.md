# AGENTS.md — 工程契約（給所有 AI Agent 與工程師）

> 這份文件是**規範來源（normative）**。Claude、Codex、Cursor 等任何 agent 在本 repo 工作前都要先讀它，並嚴格遵守。CLAUDE.md 只是指向這裡。
>
> **規範 vs 說明**：本檔與 `docs/PRINCIPLES.md` 是規範（「你必須怎麼做」，衝突時以此為準）；`docs/SPEC.md` 是功能規格書（系統現在做什麼，隨功能同步維護）；`docs/` 其餘文件是說明（informative）。若發現說明文件與規範或程式碼牴觸，以規範為準並回報。完整索引見 `docs/README.md`（文件地圖）。
>
> `{{…}}` 是模板佔位符，由 `setup` 入口初始化時填寫；看到未填的佔位符，先提醒使用者走 setup 或 framework 入口補齊，不要自行假設。

## 這是什麼

{{專案一句話定位：叫什麼、給誰用、解決什麼問題。（setup 填寫）}}

## 技術棧（不要擅自更換）

技術棧已經決定，初始化時不用改；要換技術棧，走 framework 入口討論並更新本節。

- 執行環境：Node.js 24.14.1 以上的 24，或 26（都是 LTS），TypeScript。更舊的 Node 24 附的 npm 會改寫
  `package-lock.json`，所以 `package.json` 的 `engines` 與 `.npmrc` 的 `engine-strict` 讓版本不對時 `npm install` 直接停止。
- 後端：Express 5，資料庫用 pg（node-postgres）直接寫 SQL，不用 ORM。
- 前端：React，加上 React Router 與 Vite。
- 資料庫：PostgreSQL 17；本機用 Docker Compose 啟動（`docker-compose.yml` 的 `db`）。
- 測試與檢查：Vitest 加 supertest（API 測試）、ESLint、TypeScript。
- Staging：Render（網站）加 Neon（資料庫）。
- 沒有 Mobile App。

## 目錄分層

```
frontend/                 產品程式碼：畫面（React＋Vite）
  src/pages/              一個網址一個頁面
  src/components/         共用元件：AppShell（頁首、頁尾）、RequireLogin（需要登入的頁面）
  src/api.ts              呼叫後端的唯一入口（自動帶 API 位址與登入資訊）
backend/                  產品程式碼：API、資料庫指令與測試
  src/app.ts              middleware 的順序與路由；新功能的 API 在這裡註冊
  src/auth/               測試帳號快速登入、session、requireUser（模板內建，沒有票寫明不改）
  src/middleware/         request log、錯誤格式
  db/migrations/          Migration：NNN_動作_對象.sql，只新增
  db/seeds/               種子資料：NN_名稱.sql，可以重複執行
  test/                   API 測試（Vitest＋supertest），共用 helpers.ts
docs/                     SPEC、測試帳號（test-accounts.md）、框架文件
```

新功能照現有的範例長：API 照 `backend/src/auth/routes.ts`，測試照 `backend/test/auth.test.ts`，頁面照 `frontend/src/pages/Login.tsx`。

> 產品程式碼目錄同時要登記在 `scripts/framework-config.sh` 的 `PRODUCT_DIRS`——
> 那是「無票不開發」閘門的守備範圍，漏登記 = 閘門不設防。

## Agent 環境

本 repo 支援 Claude / Codex / Cursor，但工程契約只有本檔一份。

- `AGENTS.md`：所有 agent 與工程師的規範來源。
- `.agents/skills/`：Claude / Codex / Cursor 共用的 canonical skills（角色入口與工作流）。
- `.claude/skills/`：Claude Code adapter，只指向 `.agents/skills/`，不要在這裡維護第二套流程。
- `.claude/settings.json`：Claude Code hooks（開場簡報、票務閘門、git 同步閘門）與權限。
- `.cursor/rules/`：Cursor always-apply rules，指向本檔與 `.agents/skills/`。
- Codex：先讀本檔；需要 workflow 時以 `.agents/skills/` 作為 repo-local skill catalog。

更新 Agent 流程時，先改 `.agents/skills/`，再確認 Claude/Cursor adapter 仍指向正確入口。

## 核心原則

1. **後端（伺服器側）是單一事實來源**：資料形狀、驗證、權限以後端為準，介面型別對齊後端契約。
2. **多介面同步**：專案有多個使用者介面（Web / Mobile / 桌面）時，任何功能新增、刪除、欄位修改、
   API 契約修改、權限/狀態流程修改，預設所有介面同步完成到可用狀態；除非使用者明確限定只改一側。
3. **資料隔離**：屬於使用者的資料一定以登入者過濾，避免越權；介面不決定 owner/role/price 等權威欄位。
4. **設定全走環境變數**：程式碼不寫死祕密；新增設定要有預設值且可被 env 覆寫；env 實檔不進版控。
5. **功能規格書同步**：本專案「目前提供哪些功能、怎麼運作」以 `docs/SPEC.md` 為單一事實來源。
   任何使用者可見功能的新增 / 修改 / 刪除都要在同一次變更更新 SPEC。詳見「功能規格書」一節。

本專案的原則：

6. **Migration 只新增**：資料庫結構一律新增一個 `backend/db/migrations/NNN_動作_對象.sql`（編號接在最後一個之後），
   只加表、加欄位、加索引；已經執行過的 Migration 不改。規則細節見 `backend/db/migrations/README.md`。
7. **種子資料可以重跑**：寫成 `backend/db/seeds/NN_*.sql`，重複執行不會多出重複的資料；只放虛構的資料、不放密碼；
   六個測試帳號照 `docs/test-accounts.md` 的順序建立。
8. **登入者與權限在伺服器端決定**：需要登入的 API 一律掛 `requireUser`，用 `getUser(req)` 取得登入者；
   權限與狀態都在伺服器端檢查，不相信畫面送來的身分、角色或狀態。
9. **錯誤回應只有 `{error, message}`**：預期內的錯誤用 `httpError(狀態碼, 代碼, 中文訊息)`；
   沒預期到的錯誤交給錯誤處理，使用者只看到「系統忙碌，請稍後再試」，不回 Stack Trace。
10. **Log 用 `req.log`**：自動帶 `req=請求編號`；只記 `user_id`，不記姓名、Email、Token 與請求內容。
11. **新設定寫進 `.env.example`**：加上一行註解說明用途；程式要有預設值，或啟動時清楚說明缺少什麼。
12. **登入機制不動**：沒有票寫明，不改 `backend/src/auth/`。需要使用者的新欄位（部門、角色等），用新的 Migration 加在 `users` 表。

## 生產鐵則（「能跑」不等於「能上線」）

> VibeCoding 最大的坑是只想到 happy path，沒想到並發、重試、資安、維護。
> **每加一個功能，照 [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) 的清單逐條檢查。** 摘要：

- **並發安全**：讀-改-寫（庫存/餘額/狀態）一律加鎖或用原子操作。
- **可重試（idempotent）**：使用者會雙擊、客戶端會重送、背景任務會重跑——同一操作跑兩次必須安全。
- **效能**：列表端點防 N+1、一律分頁、filter 欄位加索引。
- **資安**：權威欄位一律後端決定，不信任前端；認證端點限流；log 不記 PII。
- **可演進**：API 版本化、統一錯誤格式、資料庫遷移用 expand/contract，不做破壞性單步變更。

## Ticket 工作流（角色入口，強制）

本 repo 以**功能票**驅動開發，角色入口皆為 `.agents/skills/` 內的 skill：

- **team-leader**：session 開始先簡報專案現況（SPEC 狀態、tickets 進度、分支/環境），再引導選擇入口。
- **pm**（規格引導員 + 非工程師開發入口）：給**不懂 code 的 PM／案主**用。與案主討論需求，
  **必問「哪些角色使用、要達成什麼目的、驗收標準、邊界」**，確認後開票到
  `tickets/`（格式見 `tickets/README.md`）並同步 `docs/SPEC.md`（⏳）；討論過程與 demo 素材放
  `cache/`（**不進版控**）。**PM 也能實際開發並出貨**——由 agent 主導、用白話回報
  （不秀 diff／技術細節），依「分支與出貨流程」把功能做出來、實機測試；但**開發前一樣先開票**。
- **dev**（開發者入口）：給**工程師**用，以工程語言參與技術判斷。**無票不開發**——任何會改動程式碼的
  新功能 / 行為修改，必須對應一張 `待開發`/`開發中` 的票；動工前先檢查架構 / 既有功能 / 其他票 /
  資安衝突。例外：純問答、調查、跑檢查、不改行為的紅燈救火（事後行為有變要補票）。
- **pm 與 dev 的差別在「使用者是誰」與呈現方式，不在能力**：兩者都先開票、都走同一套「分支與出貨流程」。
- **framework**（框架入口）：討論與修改協作框架本身（入口 / 規則 / 工作流）。**豁免功能票**，
  但每次變更必須寫入 `docs/FRAMEWORK.md` 決策紀錄；不碰業務程式碼。
- **setup**（初始化精靈）：模板首次使用的引導入口；初始化完成（`.template-uninitialized` 刪除）後不再觸發。

票的狀態流：`待開發 → 開發中 → 完成`（作廢標 `作廢` 不刪檔）。票完成 = 程式 + 測試 + SPEC 同步一起完成。

**多 session 平行協作（領票制）**：動工＝把票標 `開發中` 同時填 `owner`（自己的代號，
例 amy-mac、cloud-a）；看到他人 owner 的開發中票不碰其範圍，要接手先問使用者；平行開發各走
自己的 feature 分支（同機多 session 建議各開 git worktree）；push 防踩由 git-sync-gate hook 強制。
細節見 `tickets/README.md`。

**兩道確認閘**：開票後→問使用者「現在開發嗎？」同意才動工；檢查綠燈後→問「上實機嗎？」
同意才 merge/push/部署。**授權單次有效，不跨票、不跨回合延續。**

**背景 subagent（長任務）**：大範圍調查、demo 素材、已開票的長實作可派背景 subagent 執行，
主對話不中斷；實作型限**隔離 worktree**，完成後由主對話驗證與驗收才合回。
「無票不開發」同樣約束 subagent；背景任務進行中，每回合開頭回報一行狀態。

框架設計與歷次決策見 `docs/FRAMEWORK.md`；派工門檻與模板見 `docs/harness/`。

## 分支與出貨流程（pm/dev 共用）

分支模型是**「分支即環境」**（權威定義見 `CONTRIBUTING.md`）：

1. **確認有票**：對應一張 `待開發`/`開發中` 的票（PM 也先開票；無票不開發由 PreToolUse hook 機制化強制）。
2. **開 feature 分支**：從整合分支 **`stage`** 開 `feature/<票號>-<短題>`。
3. **依票實作**：依「怎麼加一個功能」；多介面預設同步；動工時票標 `開發中`＋填 `owner`（領票）。
4. **本機驗證**：跑「改完一定要跑的最小驗證」綠燈；同步 `docs/SPEC.md`。
5. **判斷可實機測試 → 先問使用者**：功能在本機可用、檢查綠燈後，**停下來詢問使用者是否進行實機測試**
   （對外、較難復原的動作一律先確認；PM 入口用白話問）。
6. **實機測試 = 進 `stage`**：使用者同意後 → merge `feature/*` → **`stage`**；**push 前一律先同步遠端**
   （`git pull --rebase origin <分支>`，在本地解衝突再推）——此規則由 PreToolUse hook
   （`scripts/git-sync-gate-hook.sh`）機制化強制。部署方式依專案設定：
   合併進 `stage` 不會自動部署；Staging 由人在 Render 按部署，見下方「部署」。
7. **驗收**：實機驗收通過 → 票標 `完成`、開發備註寫實作決策與 commit、`docs/SPEC.md` 同步。

**分支模型**：`stage` 是預設整合分支；`prod` 是 production（把驗過的 `stage` merge 進 `prod`）。
進 `stage`/`prod` 與部署都是對外動作，執行前一律取得使用者確認。

## 怎麼加一個功能（標準流程）

1. **資料表**：新增 `backend/db/migrations/NNN_動作_對象.sql`，執行 `npm run db:migrate`。
2. **API**：在 `backend/src/` 新增一個路由模組（例：`claims/routes.ts`，寫法照 `auth/routes.ts`），
   在 `backend/src/app.ts` 的「新功能的 API」那裡註冊。查資料用 `req.db.query()`（值一律用 `$1`、`$2` 帶入），
   要一起成功或一起失敗的多個寫入用 `req.db.tx()`；需要登入的掛 `requireUser`。
3. **測試**：在 `backend/test/` 新增 `*.test.ts`，一律用 `helpers.ts` 的 `createTestApp`、`resetTestDb`、
   `createUser`、`loginAs`；驗收條件各寫一個測試。
4. **畫面**：在 `frontend/src/pages/` 新增頁面，呼叫後端一律用 `api.ts` 的 `api()`；在 `frontend/src/App.tsx`
   加路由，需要登入的頁面放在 `RequireLogin` 底下。按鈕送出中要鎖住；手機寬度不能左右捲動。
5. **示範資料**：需要的話，新增或修改 `backend/db/seeds/NN_*.sql`（可以重跑），用 `npm run db:seed` 放入。
6. **新設定**：寫進 `.env.example`，並在 README 說明。

- 規格：動工前先讀 `docs/SPEC.md` 對焦既有行為；完工後把這次的變更寫回 `docs/SPEC.md`。

## 功能規格書（`docs/SPEC.md`）— 隨功能同步維護的單一事實來源

`docs/SPEC.md` 用非工程師也讀得懂的方式，記錄本專案**目前實際提供哪些使用者可見功能、每個功能怎麼運作**。目的有三：

1. **防 VibeCoding 改壞**：動工前先讀 SPEC，掌握既有行為與邊界，才不會改 A 功能把 B 功能弄掛。
2. **改壞好追蹤**：每次功能變更都在 SPEC 留紀錄，出問題時能對照「本來應該長怎樣」回推哪裡退化。
3. **好跟案主說明**：SPEC 是非工程師看得懂的功能清單，可直接拿來對焦需求、驗收與報價。

規則（強制）：

- **功能改了就要同一次改 SPEC**：任何使用者可見功能的新增 / 修改 / 刪除——含資料模型、API 契約、
  畫面/表單、權限、狀態流程、驗收標準——都要在同一次變更更新 `docs/SPEC.md`。SPEC 沒更新 = 變更未完成。
- **案主新需求要主動更新**：使用者轉述「案主/客戶有新要求」時，即使還沒寫程式，也先把需求反映進
  `docs/SPEC.md`（標 `⏳ 未開始`），再進入實作。
- **每個功能都要標狀態，並維護總覽**：`✅ 已完成 / 🚧 進行中 / ⏳ 未開始 / 🗑 已下線`；
  SPEC 開頭維護「功能狀態總覽」表。`✅ 已完成` 只在實際可用且通過驗證後才標，不可灌水。
- **每筆變更寫進變更歷史**：SPEC 末的變更歷史表新增一列（日期、變更內容、對應功能、原因/來源、狀態）。
- **牴觸處理**：SPEC 與程式碼牴觸時，以程式碼為準並立即修正 SPEC；SPEC 與案主新需求牴觸時，先更新 SPEC 再改碼。
- **規範地位**：SPEC 描述「系統現在做什麼」，AGENTS.md / `docs/PRINCIPLES.md` 規範「你必須怎麼做」。

## 改完一定要跑的最小驗證

- 票務與框架一致性：`make check`（至少含 `ticket-lint`）。
- 專案檢查：`make check` 依序跑 ticket-lint、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`，
  全部通過最後印 `[check] OK`。測試會連本機資料庫（自動使用 `claims_test`），要先 `docker compose up -d db`。
  開發中可以只跑改到的那一側（見 `.agents/skills/run-checks/SKILL.md`），交付前一定跑完整的 `make check`。
- 功能有改：`docs/SPEC.md` 是否已同步該功能的最新行為，並在變更歷史補上這次的紀錄。

**檢查不是綠燈、測試沒過，就不算完成。** 回報時據實以告，不要宣稱通過。

## 嚴禁

- ❌ commit 任何 env 實檔、祕密、憑證（只有 `.example` 進版控）。
- ❌ commit `cache/` 內容（戰情資料，只活在本機；正式結論落到 tickets 與 SPEC）。
- ❌ 沒有對應 `tickets/` 功能票就開發新功能或修改行為（無票不開發；先走 pm 入口確認角色與目的）。
- ❌ 改了使用者可見功能（資料模型 / API / 畫面 / 權限 / 狀態流），卻沒在同一次變更更新 `docs/SPEC.md`。
- ❌ 未經確認就執行對外、難復原的動作（部署、merge 到整合/正式分支、刪/覆蓋資料、restore）。
- ❌ 開票後未經使用者本次同意就開始開發；開發完未經本次同意就 merge / push / 部署
  （**兩道確認閘**，授權單次有效、不跨票延續）。
- ❌ 在閘門（票務 / git 同步 / 部署檢查）失敗時繞過硬上。
- ❌ 修改已經執行過的 Migration，或手動改資料庫結構（要改結構就新增一個 Migration）。
- ❌ 在任何檔案（含種子資料、測試、文件）寫入密碼、Token、真實的個資。
- ❌ 沒有票寫明，就修改 `backend/src/auth/`（登入機制）。
- ❌ 在 API 回應或畫面顯示 Stack Trace；在 Log 記姓名、Email、Token 或請求內容。
- ❌ 畫面繞過 `api.ts` 直接呼叫後端，或由畫面決定權限、狀態、金額合計等權威欄位。
- ❌ 替使用者在 Render 部署、回滾，或修改 Staging 的環境變數。

## 部署

- **環境**：`feature/*` 不部署；`stage` 部署到 Staging（Render 的網站＋Neon 的資料庫）；這門課不建立 `prod`。
- **部署由人按**：只部署已經合併進 `stage` 的版本。合併不會自動部署，由使用者在 Render 按部署。
  Agent 不部署、不改 Staging 的設定：只整理部署前的資訊（要部署的版本、`make check` 的結果、
  這次新增的 Migration、回滾的目標版本），請使用者確認後自己按。
- **部署時自動做的事**：執行還沒跑過的 Migration；資料庫還沒有任何帳號時放入種子資料。
- **回滾**：回到上一個版本的程式；Migration 只新增，所以回滾不用動資料庫。
- **確認**：健康檢查 `/api/health` 的 `status`、`database` 都是 `ok`，`version` 是這次部署的版本。

## 更多文件

完整索引與「規範 vs 說明」分層見 **`docs/README.md`（文件地圖）**。重點：

- 規格：`docs/SPEC.md`（功能規格書，單一事實來源）。
- 規範：`docs/PRINCIPLES.md`（生產鐵則 + 落地檢查清單，每加功能必讀）。
- 框架：`docs/FRAMEWORK.md`（協作框架總覽與決策紀錄）、`docs/harness/`（agent 派工制度）。
- 協作：`CONTRIBUTING.md`（分支 / commit / PR）。
- 非工程師：`docs/PM_GUIDE.md`。
