# 測試帳號

練習用的六個帳號，全部是虛構的人。Day 10 的 T1 用種子資料（`backend/db/seeds/`）建立。

| id | 姓名 | Email | 部門 | role | 直屬主管 |
|---|---|---|---|---|---|
| 1 | 陳志明 | chen.zhiming@qingguang.example | 業務部 | employee | 王建宏 |
| 2 | 黃小芳 | huang.xiaofang@qingguang.example | 業務部 | employee | 王建宏 |
| 3 | 王建宏 | wang.jianhong@qingguang.example | 業務部 | employee | 周文彥 |
| 4 | 林佳慧 | lin.jiahui@qingguang.example | 財務部 | finance | 張惠如 |
| 5 | 張惠如 | zhang.huiru@qingguang.example | 財務部 | finance | 周文彥 |
| 6 | 周文彥 | zhou.wenyan@qingguang.example | 管理部 | employee | 沒有 |

- 種子資料照上表的順序建立，id 才會是 1 到 6，和教材 Log 範例的 `user_id` 對得上（例如 `user_id=3` 是王建宏、`user_id=5` 是張惠如）。
- 「主管」不是一種 role：誰是主管，由「誰是誰的直屬主管」決定。
- Email 用 `.example` 保留網域，不會寄到任何真人。
- 沒有密碼：登入頁用「測試帳號快速登入」，點一個人就登入。只在開發環境與 Staging 開啟。
- 種子資料要能重複執行，重跑不會多出重複的帳號。
