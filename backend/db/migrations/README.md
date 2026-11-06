# Migration（資料庫結構的變更紀錄）

資料庫的結構一律用這裡的 SQL 檔建立與修改，不手動改資料庫。

## 規則

- 檔名：`NNN_動作_對象.sql`，三位數字接在目前最大的編號後面，後面只用小寫英文、數字與底線。例如 `001_create_departments_and_user_fields.sql`、`004_add_settled_at_to_claims.sql`。
- 只新增：加表、加欄位、加索引。不刪欄位、不改欄位名稱或型別；真的要做，先開票討論。
- 已經執行過的檔案不改。要改結構，就再新增一個 Migration。
- 不用自己寫 `BEGIN`、`COMMIT`：工具會把每個檔案包成一個交易，失敗就整個還原。所以也不能用 `CREATE INDEX CONCURRENTLY`。
- 要讓舊資料也符合新規則（例如新的必填欄位），在同一個檔案先加欄位、補值，再加限制。

## 怎麼執行

```bash
npm run db:migrate
```

- 照編號依序執行還沒跑過的檔案，每個檔案印一行 `[migrate] 001_…完成`；都跑過了就印「已是最新」。
- 每個環境（你的電腦、Staging）用 `schema_migrations` 表記得自己跑到哪。
- 已經執行過、內容卻被改過的檔案：只警告、不重跑。
- 資料庫有、這一版程式沒有的 Migration（回滾到舊版時會這樣）：只警告、照常結束。所以「只新增」的 Migration，回滾到上一版也安全。
- 想從頭重建本機的資料庫：`npm run db:reset`（清空，從 000 起重跑全部 Migration，再放種子資料）。

## 模板內建

- `000_create_users_and_sessions`：登入用的 `users`（id、name、email、is_active、created_at）與 `sessions`。之後要在 users 加欄位，新增一個 Migration，不另建 users 表。
