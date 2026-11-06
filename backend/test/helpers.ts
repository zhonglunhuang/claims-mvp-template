// API 測試共用的工具。之後的 API 測試一律用這幾個，不要各自重寫：
//
//   const app = createTestApp();              // 連測試資料庫 claims_test 的後端
//   beforeEach(resetTestDb);                  // 每個測試前清空資料（Migration 紀錄保留）
//   const chen = await createUser({ name: '陳志明', email: 'chen.zhiming@qingguang.example' });
//   const token = await loginAs(chen.email);  // 取得登入 Token
//   await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
//   afterAll(closeTestDb);                    // 每個測試檔最後關掉資料庫連線
import { inject } from 'vitest';
import { createApp } from '../src/app.js';
import { createSession, type UserRow } from '../src/auth/session.js';
import type { AppEnv, Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { setLogSink } from '../src/logger.js';

export const TEST_SESSION_SECRET = 'test-only-session-secret';

// 測試時不把 Log 印到畫面；要檢查 Log 內容就用 captureLogs()。
setLogSink(() => {});

let sharedDb: Db | undefined;

/** 測試資料庫（claims_test）的連線。 */
export function testDb(): Db {
  sharedDb ??= createDb(inject('testDatabaseUrl'));
  return sharedDb;
}

export async function closeTestDb(): Promise<void> {
  await sharedDb?.close();
  sharedDb = undefined;
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    appEnv: 'development',
    databaseUrl: inject('testDatabaseUrl'),
    sessionSecret: TEST_SESSION_SECRET,
    apiBaseUrl: 'http://localhost:4000',
    port: 4000,
    webPort: 3000,
    ...overrides,
  };
}

/** 建一個連測試資料庫的後端，交給 supertest 的 request(app) 用。 */
export function createTestApp(options: { appEnv?: AppEnv; db?: Db } = {}) {
  return createApp({ config: testConfig({ appEnv: options.appEnv ?? 'development' }), db: options.db ?? testDb() });
}

/** 清空 schema_migrations 以外的所有資料表，編號從 1 重新開始。 */
export async function resetTestDb(): Promise<void> {
  const db = testDb();
  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  await db.query(`TRUNCATE ${rows.map((row) => `"${row.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

let userCount = 0;

/** 建一個帳號。之後的 Migration 在 users 加了欄位，直接把欄位一起傳進來，例如 { role: 'finance' }。 */
export async function createUser(fields: Record<string, unknown> = {}): Promise<UserRow> {
  userCount += 1;
  const row: Record<string, unknown> = {
    name: `測試帳號${userCount}`,
    email: `user${userCount}@test.example`,
    ...fields,
  };
  const columns = Object.keys(row);
  const { rows } = await testDb().query<UserRow>(
    `INSERT INTO users (${columns.map((column) => `"${column}"`).join(', ')})
     VALUES (${columns.map((_column, i) => `$${i + 1}`).join(', ')})
     RETURNING *`,
    Object.values(row),
  );
  return rows[0]!;
}

/** 用這個 Email 的身分登入，回傳 Token（請求帶 Authorization: Bearer <Token>）。 */
export async function loginAs(email: string): Promise<string> {
  const { rows } = await testDb().query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) throw new Error(`loginAs：找不到這個 Email 的帳號：${email}`);
  return createSession(testDb(), TEST_SESSION_SECRET, user.id);
}

/** 收集接下來印出的 Log，用來檢查 Log 的內容。 */
export function captureLogs(): string[] {
  const lines: string[] = [];
  setLogSink((line) => lines.push(line));
  return lines;
}
