import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

interface SyncConfig {
  intervalMinutes: number;
  sources: Array<{ type: string; url?: string; path?: string }>;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

function startSyncLoop(config: SyncConfig): void {
  const intervalMs = config.intervalMinutes * 60 * 1000;

  const runSync = (): void => {
    const updated: string[] = [];
    for (const source of config.sources) {
      if (source.type === 'git' || source.type === 'registry') {
        // Placeholder until remote adapters are wired.
      }
    }

    if (updated.length > 0) {
      parentPort?.postMessage({ type: 'sync_complete', skillsUpdated: updated } satisfies WorkerMessage);
    }
  };

  runSync();
  syncTimer = setInterval(runSync, intervalMs);
}

if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ping') {
      parentPort!.postMessage({ type: 'pong' } satisfies WorkerMessage);
    } else if (msg.type === 'start') {
      const config = msg.config as { sync?: SyncConfig };
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      if (config.sync) {
        startSyncLoop(config.sync);
      }
      parentPort!.postMessage({ type: 'ready' } satisfies WorkerMessage);
    }
  });
}
