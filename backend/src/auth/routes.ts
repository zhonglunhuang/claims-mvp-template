// 登入相關的 API（模板內建；沒有票寫明，不要修改 backend/src/auth/）。
//
//   GET  /api/auth/test-users   在職的帳號 [{id,name,email}]，依 id 排序（快速登入頁用）
//   POST /api/auth/test-login   body {"email":"…","cookie":true}；回 {"user":{…},"token":"…"}
//                               cookie:false 時只回 Token、不設 Cookie（Postman 用）
//   POST /api/auth/logout       刪掉 session、清掉 Cookie
//   GET  /api/auth/me           登入者（users 的整列）；沒登入回 401
//
// 測試帳號快速登入不用密碼，只在開發環境與 Staging 開啟；APP_ENV=production 時兩個 test 端點都回 404。
import { Router, type RequestHandler } from 'express';
import { httpError } from '../middleware/error-handler.js';
import { getUser, requireUser } from './require-user.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readToken,
  setSessionCookie,
  type UserRow,
} from './session.js';

export const authRouter = Router();

const testLoginOnly: RequestHandler = (req, _res, next) => {
  if (req.config.appEnv === 'production') {
    next(httpError(404, 'not_found', '找不到這個網址'));
    return;
  }
  next();
};

authRouter.get('/test-users', testLoginOnly, async (req, res) => {
  const { rows } = await req.db.query('SELECT id, name, email FROM users WHERE is_active ORDER BY id');
  res.json(rows);
});

authRouter.post('/test-login', testLoginOnly, async (req, res) => {
  const body: unknown = req.body;
  const email = typeof body === 'object' && body !== null && 'email' in body ? body.email : undefined;
  const useCookie = !(typeof body === 'object' && body !== null && 'cookie' in body && body.cookie === false);
  if (typeof email !== 'string' || email.trim() === '') {
    throw httpError(400, 'unknown_user', '找不到這個測試帳號');
  }

  const { rows } = await req.db.query<UserRow>(
    'SELECT * FROM users WHERE lower(email) = lower($1) AND is_active',
    [email.trim()],
  );
  const user = rows[0];
  if (!user) throw httpError(400, 'unknown_user', '找不到這個測試帳號');

  await req.db.query('DELETE FROM sessions WHERE expires_at < now()');
  const token = await createSession(req.db, req.config.sessionSecret, user.id);
  if (useCookie) setSessionCookie(req, res, token);
  req.log.info('test login succeeded', { user_id: user.id });
  res.json({ user, token });
});

authRouter.post('/logout', async (req, res) => {
  const token = readToken(req);
  if (token) await deleteSession(req.db, req.config.sessionSecret, token);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireUser, (req, res) => {
  res.json(getUser(req));
});
