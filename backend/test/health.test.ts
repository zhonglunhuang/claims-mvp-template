import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDb } from '../src/db.js';
import { captureLogs, closeTestDb, createTestApp } from './helpers.js';

afterAll(closeTestDb);

describe('GET /api/health', () => {
  const originalCommit = process.env.RENDER_GIT_COMMIT;
  afterEach(() => {
    if (originalCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = originalCommit;
  });

  it('資料庫正常：200，status 與 database 都是 ok（本機不帶 version）', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('資料庫連不上：503，後端照常回應', async () => {
    const unreachable = createDb('postgres://claims:local_only@127.0.0.1:1/claims');
    try {
      const app = createTestApp({ db: unreachable });
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'error', database: 'error' });
      // 同一個後端還能繼續回應下一個請求
      const again = await request(app).get('/api/health');
      expect(again.status).toBe(503);
    } finally {
      await unreachable.close();
    }
  });

  it('Staging：多一個 version，是 RENDER_GIT_COMMIT 的前 7 碼', async () => {
    process.env.RENDER_GIT_COMMIT = '9e3b6d0a1c2f4e5d6b7a8c9d0e1f2a3b4c5d6e7f';
    const res = await request(createTestApp({ appEnv: 'staging' })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok', version: '9e3b6d0' });
    expect(res.headers['x-robots-tag']).toBe('noindex');
  });

  it('健康檢查不寫進 Log', async () => {
    const logs = captureLogs();
    await request(createTestApp()).get('/api/health');
    expect(logs).toEqual([]);
  });
});
