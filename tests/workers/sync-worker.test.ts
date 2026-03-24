import { describe, it, expect, afterEach } from 'vitest';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';

const WORKER_PATH = join(__dirname, '../../dist/workers/sync-worker.js');

describe('sync-worker', () => {
  let worker: Worker | undefined;

  afterEach(async () => {
    if (worker) {
      await worker.terminate();
      worker = undefined;
    }
  });

  it('does not crash when sources is at top level (issue #2)', async () => {
    worker = new Worker(WORKER_PATH);

    const result = await new Promise<{ type: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker did not respond within 3s')), 3_000);

      worker!.on('message', (msg: { type: string }) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });

      worker!.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Send config matching the real Config shape: sources at top level, not inside sync
      worker!.postMessage({
        type: 'start',
        config: {
          sync: { intervalMinutes: 60, autoUpdate: true },
          sources: [
            { type: 'git', url: 'https://example.com/skills.git' },
            { type: 'local', path: '/tmp/skills' },
          ],
        },
      });
    });

    expect(result.type).toBe('ready');
  });

  it('handles missing sources gracefully', async () => {
    worker = new Worker(WORKER_PATH);

    const result = await new Promise<{ type: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker did not respond within 3s')), 3_000);

      worker!.on('message', (msg: { type: string }) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });

      worker!.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Config with sync but no sources at all
      worker!.postMessage({
        type: 'start',
        config: {
          sync: { intervalMinutes: 30, autoUpdate: false },
        },
      });
    });

    expect(result.type).toBe('ready');
  });

  it('responds to ping with pong', async () => {
    worker = new Worker(WORKER_PATH);

    const result = await new Promise<{ type: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker did not respond within 3s')), 3_000);

      worker!.on('message', (msg: { type: string }) => {
        if (msg.type === 'pong') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });

      worker!.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      worker!.postMessage({ type: 'ping' });
    });

    expect(result.type).toBe('pong');
  });
});
