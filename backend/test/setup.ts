// 測試開始前跑一次（vitest 的 globalSetup）：準備測試專用的資料庫 claims_test。
// 1. 把 DATABASE_URL 的資料庫名稱換成 claims_test，沒有就建立（不會動到練習用的 claims）。
// 2. 清空 claims_test，從 000 起重跑全部 Migration，確保每次測試都從同一個結構開始。
import type { TestProject } from 'vitest/node';
import { migrate } from '../db/migrate.js';
import { loadEnvFile } from '../src/config.js';
import { createDb, withDatabaseName } from '../src/db.js';
import { errorMessage } from '../src/logger.js';

export const TEST_DATABASE_NAME = 'claims_test';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

async function prepareTestDatabase(): Promise<string> {
  loadEnvFile();
  const baseUrl = process.env.DATABASE_URL?.trim();
  if (!baseUrl) throw new Error('測試需要 DATABASE_URL（寫在 .env 或環境變數），請參考 .env.example');
  const testUrl = withDatabaseName(baseUrl, TEST_DATABASE_NAME);

  const admin = createDb(baseUrl);
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DATABASE_NAME]);
    if (rows.length === 0) await admin.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
  } catch (err) {
    throw new Error(
      `連不上資料庫：${errorMessage(err)}（先執行 docker compose up -d db，等 docker compose ps 顯示 healthy）`,
      { cause: err },
    );
  } finally {
    await admin.close();
  }

  const db = createDb(testUrl);
  try {
    await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await migrate(db, { print: () => {} });
  } catch (err) {
    throw new Error(`準備測試資料庫時，執行 Migration 失敗：${errorMessage(err)}`, { cause: err });
  } finally {
    await db.close();
  }
  return testUrl;
}

export default async function setup(project: TestProject): Promise<void> {
  try {
    project.provide('testDatabaseUrl', await prepareTestDatabase());
  } catch (err) {
    // 這裡丟出的錯誤，vitest 顯示前會先整理 Stack Trace，目前的版本會在整理時自己出錯
    // （畫面只剩 code.charCodeAt is not a function），蓋掉真正的原因。
    // 所以先把 stack 設成訊息本身，畫面一定看得到原因。
    const error = new Error(`測試沒辦法開始。${errorMessage(err)}`);
    error.stack = error.message;
    throw error;
  }
}
