import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

interface ScannerConfig {
  periodicScanIntervalHours: number;
}

let scanTimer: ReturnType<typeof setInterval> | null = null;

function startScanLoop(config: ScannerConfig): void {
  const intervalMs = config.periodicScanIntervalHours * 60 * 60 * 1000;

  const runScan = (): void => {
    // Placeholder loop; scanner orchestration will be added with adapters.
  };

  runScan();
  scanTimer = setInterval(runScan, intervalMs);
}

if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ping') {
      parentPort!.postMessage({ type: 'pong' } satisfies WorkerMessage);
    } else if (msg.type === 'start') {
      const config = msg.config as { security?: ScannerConfig };
      if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
      }
      if (config.security) {
        startScanLoop(config.security);
      }
      parentPort!.postMessage({ type: 'ready' } satisfies WorkerMessage);
    }
  });
}
