import { once } from 'node:events';
import type http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/config.js';
import { listen } from '../src/listen.js';
import { closeTestDb, createTestApp } from './helpers.js';

afterAll(closeTestDb);

/** 這台電腦在區域網路上的 IPv4 位址（例如 Wi-Fi 的 192.168.x.x），同一個網路的其他電腦用它連進來；沒有網路就是 undefined。 */
function lanAddress(): string | undefined {
  return Object.values(os.networkInterfaces())
    .flat()
    .find((info) => info?.family === 'IPv4' && !info.internal)?.address;
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(2000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

/** 用 npm run dev:api 同一個方式開始接收請求（埠用 0，讓系統挑一個沒人用的）。 */
async function start(appEnv: AppEnv): Promise<{ server: http.Server; address: AddressInfo }> {
  const server = listen(createTestApp({ appEnv }), { appEnv, port: 0 });
  await once(server, 'listening');
  return { server, address: server.address() as AddressInfo };
}

async function stop(server: http.Server): Promise<void> {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

describe('後端接收連線的位置', () => {
  it('development：只綁本機的 127.0.0.1，這台電腦連得到', async () => {
    const { server, address } = await start('development');
    try {
      expect(address.address).toBe('127.0.0.1');
      const res = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      expect(res.status).toBe(200);
    } finally {
      await stop(server);
    }
  });

  it.skipIf(!lanAddress())('development：同一個網路的其他電腦（這台電腦的區域網路位址）連不進來', async () => {
    const { server, address } = await start('development');
    try {
      expect(await canConnect(lanAddress()!, address.port)).toBe(false);
      expect(await canConnect('127.0.0.1', address.port)).toBe(true);
    } finally {
      await stop(server);
    }
  });

  it('Staging：監聽所有網路介面（Render 從主機外面把請求轉進來）', async () => {
    const { server, address } = await start('staging');
    try {
      expect(['::', '0.0.0.0']).toContain(address.address);
    } finally {
      await stop(server);
    }
  });
});
