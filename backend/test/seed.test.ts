import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../db/seed.js';
import { closeTestDb, createUser, resetTestDb, testDb } from './helpers.js';

beforeEach(resetTestDb);
afterAll(closeTestDb);

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function seedDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-seeds-'));
  tempDirs.push(dir);
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

const users = {
  '01_users.sql': `INSERT INTO users (name, email) VALUES
    ('陳志明', 'chen.zhiming@qingguang.example'),
    ('黃小芳', 'huang.xiaofang@qingguang.example')
    ON CONFLICT (email) DO NOTHING;`,
};

async function userCount(): Promise<number> {
  const { rows } = await testDb().query<{ count: string }>('SELECT count(*) FROM users');
  return Number(rows[0]!.count);
}

describe('npm run db:seed', () => {
  it('沒有種子檔：印出提示，不改資料', async () => {
    const lines: string[] = [];
    const result = await seed(testDb(), { dir: seedDir({}), print: (line) => lines.push(line) });
    expect(result.skipped).toBe('no_files');
    expect(lines).toEqual(['[seed] 沒有種子資料檔（backend/db/seeds/*.sql，Day 10 的 T1 會建立）']);
  });

  it('依序執行，每個檔案印一行；種子檔寫成可以重跑，重跑不會多出重複的資料', async () => {
    const lines: string[] = [];
    await seed(testDb(), { dir: seedDir(users), print: (line) => lines.push(line) });
    await seed(testDb(), { dir: seedDir(users), print: () => {} });
    expect(lines).toEqual(['[seed] 01_users……完成']);
    expect(await userCount()).toBe(2);
  });

  it('--if-empty：還沒有任何帳號才放入', async () => {
    const lines: string[] = [];
    const result = await seed(testDb(), { dir: seedDir(users), ifEmpty: true, print: (line) => lines.push(line) });
    expect(result.files).toEqual(['01_users']);
    expect(await userCount()).toBe(2);
  });

  it('--if-empty：已經有帳號就略過', async () => {
    await createUser({ name: '已經在的人', email: 'someone@test.example' });
    const lines: string[] = [];
    const result = await seed(testDb(), { dir: seedDir(users), ifEmpty: true, print: (line) => lines.push(line) });
    expect(result.skipped).toBe('has_users');
    expect(lines).toEqual(['[seed] 已經有帳號，略過']);
    expect(await userCount()).toBe(1);
  });

  it('部署時（--if-empty --deploy）印 [deploy] 開頭的訊息', async () => {
    const lines: string[] = [];
    await seed(testDb(), { dir: seedDir(users), ifEmpty: true, deploy: true, print: (line) => lines.push(line) });
    await seed(testDb(), { dir: seedDir(users), ifEmpty: true, deploy: true, print: (line) => lines.push(line) });
    expect(lines).toEqual(['[deploy] 種子資料：放入……完成', '[deploy] 種子資料：已經有帳號，略過']);
  });

  it('任何一個檔案失敗：全部還原，不會只放一半', async () => {
    const dir = seedDir({ ...users, '02_broken.sql': 'INSERT INTO no_such_table VALUES (1);' });
    await expect(seed(testDb(), { dir, print: () => {} })).rejects.toThrow('02_broken 失敗，全部還原');
    expect(await userCount()).toBe(0);
  });
});
