// 後端開始接收請求的位置（npm run dev:api 與 Staging 都從這裡開始）。
// - development：只綁本機的 127.0.0.1。這台電腦用 http://localhost:4000 連得到；
//   同一個網路（例如教室的 Wi-Fi）的其他電腦連不進來。本機的後端有不用密碼的快速登入，不能讓別人連。
// - 其他環境（Staging）：Render 從主機外面把請求轉進來，所以監聽所有網路介面。
import type http from 'node:http';
import type { Express } from 'express';
import type { Config } from './config.js';

/** development 只接受這台電腦自己的連線。 */
export const DEVELOPMENT_HOST = '127.0.0.1';

export function listen(app: Express, config: Pick<Config, 'appEnv' | 'port'>): http.Server {
  return config.appEnv === 'development' ? app.listen(config.port, DEVELOPMENT_HOST) : app.listen(config.port);
}
