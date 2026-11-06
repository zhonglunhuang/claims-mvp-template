import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, inject } from 'vitest';
import { checksumOf, migrate } from '../db/migrate.js';
import { createDb, withDatabaseName, type Db } from '../src/db.js';
import { closeTestDb, testDb } from './helpers.js';

// Migration 工具的測試用另一個暫時的資料庫，不影響其他測試用的 claims_test。
const SCRATCH_DATABASE = 'claims_test_migrate';
let db: Db;

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function migrationDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-migrations-'));
  tempDirs.push(dir);
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

async function tableNames(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return rows.map((row) => row.tablename);
}

beforeAll(async () => {
  await testDb().query(`DROP DATABASE IF EXISTS ${SCRATCH_DATABASE} WITH (FORCE)`);
  await testDb().query(`CREATE DATABASE ${SCRATCH_DATABASE}`);
  db = createDb(withDatabaseName(inject('testDatabaseUrl'), SCRATCH_DATABASE));
});

beforeEach(async () => {
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
});

afterAll(async () => {
  await db?.close();
  await testDb().query(`DROP DATABASE IF EXISTS ${SCRATCH_DATABASE} WITH (FORCE)`);
  await closeTestDb();
});

describe('npm run db:migrate', () => {
  const files = {
    '000_create_a.sql': 'CREATE TABLE a (id int);',
    '001_create_b.sql': 'CREATE TABLE b (id int);',
    '002_add_note_to_a.sql': 'ALTER TABLE a ADD COLUMN note text;',
    'README.md': '不是 .sql，不會執行',
  };

  it('照編號依序執行，每個檔案印一行完成訊息', async () => {
    const lines: string[] = [];
    const result = await migrate(db, { dir: migrationDir(files), print: (line) => lines.push(line) });
    expect(result.applied).toEqual(['000_create_a', '001_create_b', '002_add_note_to_a']);
    expect(lines).toEqual([
      '[migrate] 000_create_a……完成',
      '[migrate] 001_create_b……完成',
      '[migrate] 002_add_note_to_a……完成',
      '[migrate] 完成',
    ]);
    expect(await tableNames(db)).toEqual(['a', 'b', 'schema_migrations']);
  });

  it('重跑沒有變化：已是最新', async () => {
    const dir = migrationDir(files);
    await migrate(db, { dir, print: () => {} });
    const lines: string[] = [];
    const result = await migrate(db, { dir, print: (line) => lines.push(line) });
    expect(result.applied).toEqual([]);
    expect(lines).toEqual(['[migrate] 已是最新，沒有要執行的 Migration', '[migrate] 完成']);
  });

  it('資料庫有、程式沒有的 Migration（回滾到舊版）：只警告，照常結束', async () => {
    await migrate(db, { dir: migrationDir({ ...files, '003_add_receipt_photo.sql': 'ALTER TABLE a ADD COLUMN photo text;' }), print: () => {} });
    const lines: string[] = [];
    const result = await migrate(db, { dir: migrationDir(files), deploy: true, print: (line) => lines.push(line) });
    expect(result.unknown).toEqual(['003_add_receipt_photo']);
    expect(lines).toEqual([
      '[deploy] 資料庫已經執行過 003_add_receipt_photo，這一版的程式沒有這個檔（可能是回滾到舊版），略過',
      '[deploy] 沒有新的 Migration',
    ]);
  });

  it('已經執行過的檔案被改過：只警告，不會重跑', async () => {
    await migrate(db, { dir: migrationDir(files), print: () => {} });
    const lines: string[] = [];
    const changed = { ...files, '001_create_b.sql': 'CREATE TABLE b (id int, extra text);' };
    const result = await migrate(db, { dir: migrationDir(changed), print: (line) => lines.push(line) });
    expect(result.modified).toEqual(['001_create_b']);
    expect(lines[0]).toBe('[migrate] 警告：已經執行過的 001_create_b 被修改過，不會重跑；要改結構請新增一個 Migration');
    const { rows } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'b'`);
    expect(rows.map((row) => row.column_name)).toEqual(['id']);
  });

  it('只有換行符號不同（Windows 的 CRLF）不算被改過', () => {
    expect(checksumOf('CREATE TABLE a (id int);\r\nSELECT 1;\r\n')).toBe(checksumOf('CREATE TABLE a (id int);\nSELECT 1;\n'));
  });

  it('部署時（--deploy）印 [deploy] 開頭的訊息', async () => {
    const lines: string[] = [];
    await migrate(db, { dir: migrationDir(files), deploy: true, print: (line) => lines.push(line) });
    expect(lines).toEqual([
      '[deploy] 執行 Migration：000_create_a……完成',
      '[deploy] 執行 Migration：001_create_b……完成',
      '[deploy] 執行 Migration：002_add_note_to_a……完成',
    ]);
  });

  it('某個檔案失敗：那個檔案整個還原，前面成功的保留，錯誤原文照印', async () => {
    const dir = migrationDir({ ...files, '003_broken.sql': 'CREATE TABLE c (id int); SELECT * FROM no_such_table;' });
    await expect(migrate(db, { dir, print: () => {} })).rejects.toThrow(
      '003_broken 失敗，已還原這個檔案的變更：relation "no_such_table" does not exist',
    );
    expect(await tableNames(db)).toEqual(['a', 'b', 'schema_migrations']);
  });

  it('檔名不符合規則或編號重複：不執行任何檔案', async () => {
    await expect(migrate(db, { dir: migrationDir({ '001_Create_Users.sql': 'SELECT 1;' }), print: () => {} })).rejects.toThrow(
      '檔名不符合規則：001_Create_Users.sql',
    );
    await expect(
      migrate(db, { dir: migrationDir({ '001_a.sql': 'SELECT 1;', '001_b.sql': 'SELECT 1;' }), print: () => {} }),
    ).rejects.toThrow('編號重複：001_a.sql、001_b.sql');
    expect(await tableNames(db)).toEqual([]);
  });

  it('模板內建的 000：建立 users 與 sessions', async () => {
    const result = await migrate(db, { print: () => {} });
    expect(result.applied[0]).toBe('000_create_users_and_sessions');
    expect(await tableNames(db)).toEqual(expect.arrayContaining(['schema_migrations', 'sessions', 'users']));
  });
});
