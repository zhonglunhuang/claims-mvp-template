// 需要登入的 API：路由掛 requireUser，handler 裡用 getUser(req) 取得登入者（users 的整列）。
//
//   router.get('/', requireUser, async (req, res) => {
//     const user = getUser(req);
//     ...權限與狀態一律在這裡（伺服器端）檢查，不相信畫面送來的身分或狀態...
//   });
import type { Request, RequestHandler } from 'express';
import { httpError } from '../middleware/error-handler.js';
import type { UserRow } from './session.js';

/** 沒登入（或帳號已停用）回 401 {"error":"unauthorized","message":"請先登入"}。 */
export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(httpError(401, 'unauthorized', '請先登入'));
    return;
  }
  next();
};

export function getUser(req: Request): UserRow {
  if (!req.user) throw httpError(401, 'unauthorized', '請先登入');
  return req.user;
}
