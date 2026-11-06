// npm run db:seed：依序執行 backend/db/seeds/NN_名稱.sql，放入種子資料（虛構的測試資料）。
//
// - 全部檔案放在同一個交易：任何一個失敗，全部還原，不會只放一半。
// - 種子檔要能重複執行（例如 INSERT … ON CONFLICT DO NOTHING），重跑不會多出重複的資料。
// - 加 --if-empty：users 已經有資料就略過（部署時用，只有第一次會放）。
// - 加 --deploy（部署時用）會改印 [deploy] 開頭的訊息。
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.js';
import type { Db } from '../src/db.js';
import { errorMessage } from '../src/logger.js';
import { CliError, isMainModule, runCli } from './cli.js';

export const SEEDS_DIR = path.join(REPO_ROOT, 'backend', 'db', 'seeds');
const FILE_PATTERN = /^\d{2}_[a-z0-9_]+\.sql$/;

export interface SeedOptions {
  dir?: string;
  ifEmpty?: boolean;
  deploy?: boolean;
  print?: (line: string) => void;
}

export interface SeedResult {
  /** 這次執行的種子檔（不含 .sql） */
  files: string[];
  /** 沒有執行的原因 */
  skipped?: 'no_files' | 'has_users';
}

function readSeedFiles(dir: string): { name: string; sql: string }[] {
  if (!fs.existsSync(dir)) return [];
  const sqlFiles = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const invalid = sqlFiles.filter((file) => !FILE_PATTERN.test(file));
  if (invalid.length > 0) {
    throw new CliError(
      `檔名不符合規則：${invalid.join('、')}（要像 01_departments_users.sql：兩位數字、底線，後面只用小寫英文、數字與底線）`,
    );
  }
  return sqlFiles.map((file) => ({
    name: file.replace(/\.sql$/, ''),
    sql: fs.readFileSync(path.join(dir, file), 'utf8'),
  }));
}

export async function seed(db: Db, options: SeedOptions = {}): Promise<SeedResult> {
  const print = options.print ?? ((line: string) => console.log(line));
  const files = readSeedFiles(options.dir ?? SEEDS_DIR);

  if (files.length === 0) {
    print(
      options.deploy
        ? '[deploy] 種子資料：沒有種子資料檔，略過'
        : '[seed] 沒有種子資料檔（backend/db/seeds/*.sql，Day 10 的 T1 會建立）',
    );
    return { files: [], skipped: 'no_files' };
  }

  if (options.ifEmpty) {
    const { rows } = await db.query<{ has_users: boolean }>('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
    if (rows[0]?.has_users) {
      print(options.deploy ? '[deploy] 種子資料：已經有帳號，略過' : '[seed] 已經有帳號，略過');
      return { files: [], skipped: 'has_users' };
    }
  }

  await db.tx(async (client) => {
    for (const file of files) {
      try {
        await client.query(file.sql);
      } catch (err) {
        throw new CliError(`${file.name} 失敗，全部還原，沒有放入任何資料：${errorMessage(err)}`);
      }
    }
  });

  if (options.deploy) {
    print('[deploy] 種子資料：放入……完成');
  } else {
    for (const file of files) print(`[seed] ${file.name}……完成`);
  }
  return { files: files.map((file) => file.name) };
}

if (isMainModule(import.meta.url)) {
  const deploy = process.argv.includes('--deploy');
  const ifEmpty = process.argv.includes('--if-empty');
  await runCli(deploy ? '[deploy]' : '[seed]', async (db) => {
    await seed(db, { deploy, ifEmpty });
  });
}
