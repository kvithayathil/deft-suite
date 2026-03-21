import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

interface IndexConfig {
  intervalMinutes?: number;
}

let indexTimer: ReturnType<typeof setInterval> | null = null;

function startIndexLoop(config: IndexConfig): void {
  const intervalMs = (config.intervalMinutes ?? 60) * 60 * 1000;

  const rebuild = (): void => {
    // Placeholder: event-driven rebuild hooks are wired later.
  };

  rebuild();
  indexTimer = setInterval(rebuild, intervalMs);
}

if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ping') {
      parentPort!.postMessage({ type: 'pong' } satisfies WorkerMessage);
    } else if (msg.type === 'start') {
      const config = msg.config as { index?: IndexConfig };
      if (indexTimer) {
        clearInterval(indexTimer);
        indexTimer = null;
      }
      startIndexLoop(config.index ?? {});
      parentPort!.postMessage({ type: 'ready' } satisfies WorkerMessage);
    }
  });
}
