// 自動化測試（npm test，含在 make check）：只跑後端的 API 測試。
// 測試連本機資料庫裡的 claims_test（globalSetup 自動建立、每次從 000 起重跑 Migration），不動練習用的 claims。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/test/**/*.test.ts'],
    globalSetup: ['backend/test/setup.ts'],
    environment: 'node',
    // 測試共用同一個資料庫，一次只跑一個檔案，彼此不會互相清掉資料。
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
