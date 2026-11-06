// 登入的 session（模板內建；沒有票寫明，不要修改 backend/src/auth/）。
//
// - 登入時產生一個 Token（32 bytes 的 base64url），只交給使用者；
//   資料庫的 sessions.id 存的是 HMAC-SHA256(SESSION_SECRET, Token)，資料庫外流也拿不到 Token。
// - 有效 8 小時。
// - Token 放在 Cookie（claims_session，瀏覽器用），或 Authorization: Bearer <Token>（Postman 用）。
//   兩個都有時 Bearer 優先，Postman 才不會混到 Cookie 裡別人的身分。
// - 登出時刪掉 session，同一個 Token（包括複製到 Postman 的）立刻失效。
import crypto from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import type { Db } from '../db.js';

export const SESSION_COOKIE = 'claims_session';
export const SESSION_HOURS = 8;
const SESSION_MAX_AGE_MS = SESSION_HOURS * 60 * 60 * 1000;

/** users 表的整列；之後的 Migration 加的欄位（例如部門、角色）也會自動帶出來。 */
export type UserRow = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: Date;
} & Record<string, unknown>;

export function hashToken(secret: string, token: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

/** 建立 session，回傳 Token（只有這一次拿得到）。 */
export async function createSession(db: Db, secret: string, userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hashToken(secret, token), userId, SESSION_HOURS],
  );
  return token;
}

export async function deleteSession(db: Db, secret: string, token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE id = $1', [hashToken(secret, token)]);
}

/** Token 對應的使用者；過期、找不到或帳號已停用都回 undefined（當成沒登入）。 */
export async function findSessionUser(db: Db, secret: string, token: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active`,
    [hashToken(secret, token)],
  );
  return rows[0];
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/** 從請求取出 Token：有 Authorization: Bearer 就只看它；沒有才看 Cookie。 */
export function readToken(req: Request): string | undefined {
  const authorization = req.get('authorization')?.trim();
  if (authorization && /^bearer\s/i.test(authorization)) {
    return authorization.slice(6).trim() || undefined;
  }
  return readCookie(req.get('cookie'), SESSION_COOKIE);
}

function cookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    // Staging 是 https，Cookie 只走加密連線
    secure: req.config.appEnv !== 'development',
  };
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_MAX_AGE_MS });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

/** 每個 /api 請求先解析登入資訊：登入中就把 users 的整列放進 req.user。 */
export const loadSession: RequestHandler = async (req, _res, next) => {
  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }
  const token = readToken(req);
  if (token) req.user = await findSessionUser(req.db, req.config.sessionSecret, token);
  next();
};
