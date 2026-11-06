import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../src/db.js';
import { captureLogs, closeTestDb, createTestApp, createUser, loginAs, resetTestDb, testDb } from './helpers.js';

beforeEach(resetTestDb);
afterAll(closeTestDb);

function sessionCookieFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((value) => value.startsWith('claims_session='));
  if (!cookie) throw new Error('回應沒有設定 claims_session Cookie');
  return cookie.split(';')[0]!;
}

describe('沒有登入', () => {
  it('需要登入的 API 回 401，格式是 {error, message}', async () => {
    const res = await request(createTestApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized', message: '請先登入' });
  });

  it('不存在的 API 回 404「找不到這個網址」', async () => {
    const res = await request(createTestApp()).get('/api/no-such-thing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', message: '找不到這個網址' });
  });
});

describe('測試帳號快速登入', () => {
  it('列出在職的帳號，依 id 排序', async () => {
    await createUser({ name: '陳志明', email: 'chen@test.example' });
    await createUser({ name: '已離職', email: 'gone@test.example', is_active: false });
    await createUser({ name: '黃小芳', email: 'huang@test.example' });
    const res = await request(createTestApp()).get('/api/auth/test-users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: '陳志明', email: 'chen@test.example' },
      { id: 3, name: '黃小芳', email: 'huang@test.example' },
    ]);
  });

  it('Cookie 登入：設定 HttpOnly 的 claims_session，之後帶 Cookie 就是這個人', async () => {
    await createUser({ name: '陳志明', email: 'chen@test.example' });
    const app = createTestApp();
    const login = await request(app).post('/api/auth/test-login').send({ email: 'chen@test.example', cookie: true });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ id: 1, name: '陳志明', email: 'chen@test.example' });
    expect(typeof login.body.token).toBe('string');

    const setCookie = ([] as string[]).concat(login.headers['set-cookie'] ?? []).join('\n');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=28800');
    expect(setCookie).not.toContain('Secure');

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookieFrom(login));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: 1, name: '陳志明', email: 'chen@test.example', is_active: true });
  });

  it('Token 登入：cookie:false 只回 Token、不設 Cookie，之後帶 Authorization: Bearer', async () => {
    await createUser({ name: '王建宏', email: 'wang@test.example' });
    const app = createTestApp();
    const login = await request(app).post('/api/auth/test-login').send({ email: 'wang@test.example', cookie: false });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeUndefined();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('王建宏');
  });

  it('Bearer 優先於 Cookie', async () => {
    await createUser({ name: '陳志明', email: 'chen@test.example' });
    await createUser({ name: '張惠如', email: 'zhang@test.example' });
    const app = createTestApp();
    const chenLogin = await request(app).post('/api/auth/test-login').send({ email: 'chen@test.example' });
    const zhangToken = await loginAs('zhang@test.example');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookieFrom(chenLogin))
      .set('Authorization', `Bearer ${zhangToken}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('張惠如');
  });

  it('找不到或已停用的帳號：400 unknown_user', async () => {
    await createUser({ name: '已離職', email: 'gone@test.example', is_active: false });
    const app = createTestApp();
    for (const email of ['nobody@test.example', 'gone@test.example']) {
      const res = await request(app).post('/api/auth/test-login').send({ email });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'unknown_user', message: '找不到這個測試帳號' });
    }
  });

  it('登出之後，同一個 Token（包括複製出去的）就失效', async () => {
    await createUser({ name: '林佳慧', email: 'lin@test.example' });
    const app = createTestApp();
    const token = await loginAs('lin@test.example');

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it('帳號停用之後，原本的登入當成沒登入', async () => {
    const user = await createUser({ name: '周文彥', email: 'zhou@test.example' });
    const token = await loginAs(user.email);
    const app = createTestApp();
    await testDb().query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it('Staging 的 Cookie 加 Secure', async () => {
    await createUser({ name: '陳志明', email: 'chen@test.example' });
    const login = await request(createTestApp({ appEnv: 'staging' }))
      .post('/api/auth/test-login')
      .send({ email: 'chen@test.example' });
    expect(login.status).toBe(200);
    expect(([] as string[]).concat(login.headers['set-cookie'] ?? []).join('\n')).toContain('Secure');
  });

  it('正式環境（production）關閉快速登入：兩個 test 端點都回 404', async () => {
    await createUser({ name: '陳志明', email: 'chen@test.example' });
    const app = createTestApp({ appEnv: 'production' });
    const users = await request(app).get('/api/auth/test-users');
    expect(users.status).toBe(404);
    const login = await request(app).post('/api/auth/test-login').send({ email: 'chen@test.example' });
    expect(login.status).toBe(404);
    expect(login.body).toEqual({ error: 'not_found', message: '找不到這個網址' });
  });
});

describe('Request log', () => {
  it('登入後的請求帶 user_id，不記 Email 與 Token', async () => {
    const user = await createUser({ name: '張惠如', email: 'zhang@test.example' });
    const token = await loginAs(user.email);
    const logs = captureLogs();
    const res = await request(createTestApp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    const requestId = res.headers['x-request-id'];
    expect(requestId).toMatch(/^[0-9a-f]{4}$/);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatch(
      new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\+08:00 INFO  req=${requestId} GET /api/auth/me user_id=${user.id}$`),
    );
    expect(logs[1]).toMatch(new RegExp(`INFO  req=${requestId} responded status=200$`));
    expect(logs.join('\n')).not.toContain('zhang@test.example');
    expect(logs.join('\n')).not.toContain(token);
  });

  it('資料庫停了、查不了登入資訊：照樣印請求那一行與 responded status=500', async () => {
    const broken = createDb('postgres://claims:local_only@127.0.0.1:1/claims');
    try {
      const logs = captureLogs();
      const res = await request(createTestApp({ db: broken }))
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-that-needs-a-database-lookup');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'internal', message: '系統忙碌，請稍後再試' });

      const requestId = res.headers['x-request-id'];
      expect(logs).toHaveLength(3);
      expect(logs[0]).toMatch(new RegExp(`INFO  req=${requestId} GET /api/auth/me$`));
      expect(logs[1]).toMatch(new RegExp(`ERROR req=${requestId} Error: connect ECONNREFUSED 127\\.0\\.0\\.1:1`));
      expect(logs[2]).toMatch(new RegExp(`INFO  req=${requestId} responded status=500$`));
      expect(logs.join('\n')).not.toContain('token-that-needs-a-database-lookup');
    } finally {
      await broken.close();
    }
  });

  it('沒預期到的錯誤：Stack Trace 只進 Log，使用者看到「系統忙碌，請稍後再試」', async () => {
    const broken = createDb('postgres://claims:local_only@127.0.0.1:1/claims');
    try {
      const logs = captureLogs();
      const res = await request(createTestApp({ db: broken })).get('/api/auth/test-users');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'internal', message: '系統忙碌，請稍後再試' });
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      const errorLine = logs.find((line) => line.includes(' ERROR '));
      expect(errorLine).toMatch(/ERROR req=[0-9a-f]{4} Error: connect ECONNREFUSED 127\.0\.0\.1:1/);
      expect(errorLine).toContain('\n    at ');
    } finally {
      await broken.close();
    }
  });
});
