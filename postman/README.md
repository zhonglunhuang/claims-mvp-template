# Postman Collection

用 Postman 直接呼叫 API，不經過畫面：權限與狀態的檢查要用它證明「伺服器端真的擋住了」。

| 檔案 | 什麼時候用 | 內容 |
|---|---|---|
| `claims-day10.postman_collection.json` | Day 10 | 六個身分的登入；T2 草稿（建立、夾帶合計、別人改不到刪不掉、金額 0／負數／明天）；T3 我的報支單（沒有登入回 401） |
| `claims-day11.postman_collection.json` | Day 11 | 送出、重複送出、用 PATCH 改狀態；主管核准、退回、不是直屬主管、審自己的單；財務確認、確認自己的單、修改已核銷的單；看別人的單、沒有登入 |
| `staging.postman_environment.json` | Day 12 | 把網址換成你的 Staging |

## 匯入

1. Postman → Import → 選這個資料夾裡要用的檔案（可以一次選三個）。
2. 左邊的 Collections 會多一個「核銷 Day 10…」或「核銷 Day 11…」。

## 用法

1. 先啟動自己的專案（資料庫、`npm run dev:api`），而且 T1 已經放好種子資料（六個測試帳號）。
2. 先送「00 登入」資料夾：每個人一個請求，用測試帳號快速登入，不用密碼。回應裡的 Token 會自動存成 `token_chen`、`token_huang`、`token_wang`、`token_lin`、`token_zhang`、`token_zhou`。
3. 之後的請求，在 Headers 都帶 `Authorization: Bearer {{token_…}}`：換身分，就是換成另一個人的 Token 變數。沒有帶 Authorization 的請求，就是「沒有登入」。
4. 照資料夾的順序一個一個送，看右下角的狀態碼與 Test Results。每個請求的說明（Docs）寫了預期結果。
5. 也可以整個資料夾一起跑：在 Collection 上按 Run（Collection Runner），照順序送出、列出每一個 Test 的結果。

| 身分 | Token 變數 | 誰 |
|---|---|---|
| 陳志明 | `token_chen` | 業務，直屬主管是王建宏 |
| 黃小芳 | `token_huang` | 業務，直屬主管是王建宏 |
| 王建宏 | `token_wang` | 業務部經理，直屬主管是周文彥 |
| 林佳慧（小林） | `token_lin` | 財務專員，直屬主管是張惠如 |
| 張惠如 | `token_zhang` | 財務主管，直屬主管是周文彥 |
| 周文彥 | `token_zhou` | 總經理，沒有直屬主管 |

## 變數

在 Collection 上按右鍵 → Edit → Variables：

| 變數 | 是什麼 |
|---|---|
| `baseUrl` | API 的位址，預設 `http://localhost:4000`。改了 `.env` 的 `API_PORT`，這裡跟著改 |
| `today`、`tomorrow` | 台灣時間的今天、明天，每次送出前自動計算（測「費用日期不可以是未來」用） |
| `token_chen` … `token_zhou` | 「00 登入」自動填入 |
| `claimId`、`claimId2`、`wangClaimId`、`linClaimId` | 建立草稿的請求自動填入。要改測你自己的單，就把這裡的單號換掉 |

## 網址以你的 API 為準

Collection 的網址與欄位照範例 Repo 的參考做法（例如 `POST /api/claims/{{claimId}}/submit`）。你的 Agent 做的路徑、欄位名稱或回應格式可能不一樣：先看 Agent 計畫裡寫的網址，或在畫面上真的按一次、在 DevTools 的 Network 看實際的網址與 Body，再改 Postman 的請求。Test 寫「403 或 404」的，兩種都算擋下。

## 換到 Staging（Day 12）

1. Postman 右上角的環境選「staging（Render）」，把 `baseUrl` 改成你的 Staging 網址（例如 `https://claims-yun.onrender.com`）。
2. 重送一次「00 登入」：本機的 Token 在 Staging 不能用，Staging 要重新登入。
3. Render 的免費方案閒置會休眠，第一個請求可能要等快 1 分鐘。

## 安全

- Token 和密碼一樣：不要貼到文件、截圖或群組；截圖前把 Headers 裡的 Token 遮住。
- 在瀏覽器按登出，或送 `POST {{baseUrl}}/api/auth/logout`（帶那個人的 Token），那個 Token 就失效，之後回 401，重送「00 登入」就好。
- 只對自己的練習環境測試。
