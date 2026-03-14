import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

if (parentPort) {
  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ping') {
      parentPort!.postMessage({ type: 'pong' } satisfies WorkerMessage);
    }
  });
  // TODO: implement periodic index rebuild loop
}
