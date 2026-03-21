import { Worker } from 'node:worker_threads';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from '../core/ports/logger.js';
import { WorkerHeartbeat } from '../resilience/worker-heartbeat.js';
import type { HeartbeatTarget } from '../resilience/worker-heartbeat.js';
import type { WorkerMessage } from './messages.js';

type WorkerStatus = 'stopped' | 'starting' | 'running' | 'hung' | 'disabled';

export interface WorkerManagerOptions {
  autoStart?: boolean;
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
}

const WORKER_NAMES = ['sync', 'scanner', 'index'] as const;
type WorkerName = typeof WORKER_NAMES[number];

function toHeartbeatTarget(worker: Worker, name: string): HeartbeatTarget {
  return {
    name,
    sendPing() {
      worker.postMessage({ type: 'ping' } satisfies WorkerMessage);
    },
    onPong(handler: () => void) {
      worker.on('message', (msg: WorkerMessage) => {
        if (msg.type === 'pong') {
          handler();
        }
      });
    },
    terminate() {
      void worker.terminate();
    },
  };
}

export class WorkerManager {
  private workers = new Map<WorkerName, Worker>();
  private heartbeats = new Map<WorkerName, WorkerHeartbeat>();
  private statuses = new Map<WorkerName, WorkerStatus>();
  private readonly options: Required<WorkerManagerOptions>;

  constructor(
    private readonly logger: Logger,
    options?: WorkerManagerOptions,
  ) {
    this.options = {
      autoStart: options?.autoStart ?? false,
      pingIntervalMs: options?.pingIntervalMs ?? 10_000,
      pongTimeoutMs: options?.pongTimeoutMs ?? 5_000,
    };

    for (const name of WORKER_NAMES) {
      this.statuses.set(name, 'stopped');
    }
  }

  getWorkerStatus(): Record<WorkerName, WorkerStatus> {
    return {
      sync: this.statuses.get('sync')!,
      scanner: this.statuses.get('scanner')!,
      index: this.statuses.get('index')!,
    };
  }

  async startAll(config: unknown): Promise<void> {
    for (const name of WORKER_NAMES) {
      await this.startWorker(name, config);
    }
  }

  private async startWorker(name: WorkerName, config: unknown): Promise<void> {
    if (this.statuses.get(name) === 'disabled') {
      this.logger.warn(`Worker ${name} is disabled for this session — too many restarts`);
      return;
    }

    this.statuses.set(name, 'starting');
    const workerFile = join(dirname(fileURLToPath(import.meta.url)), `${name}-worker.js`);

    try {
      const worker = new Worker(workerFile);
      this.workers.set(name, worker);

      worker.on('message', (msg: WorkerMessage) => {
        if (msg.type === 'ready') {
          this.statuses.set(name, 'running');
          this.logger.info(`Worker ${name} is ready`);
        }
      });

      worker.on('error', (err: Error) => {
        this.logger.error(`Worker ${name} crashed: ${err.message}`);
        this.handleWorkerCrash(name, config);
      });

      worker.on('exit', (code: number) => {
        if (code !== 0 && this.statuses.get(name) !== 'stopped') {
          this.logger.warn(`Worker ${name} exited with code ${code}`);
          this.handleWorkerCrash(name, config);
        }
      });

      const heartbeat = new WorkerHeartbeat(toHeartbeatTarget(worker, name), this.logger, {
        pingIntervalMs: this.options.pingIntervalMs,
        pongTimeoutMs: this.options.pongTimeoutMs,
        onHung: () => {
          this.logger.warn(`Worker ${name} is hung — restarting`);
          this.statuses.set(name, 'hung');
          this.handleWorkerCrash(name, config);
        },
      });
      this.heartbeats.set(name, heartbeat);
      heartbeat.start();

      worker.postMessage({ type: 'start', config } satisfies WorkerMessage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to start worker ${name}: ${message}`);
      this.statuses.set(name, 'stopped');
    }
  }

  private handleWorkerCrash(name: WorkerName, config: unknown): void {
    const heartbeat = this.heartbeats.get(name);
    if (heartbeat) {
      heartbeat.stop();
    }
    this.heartbeats.delete(name);

    const existing = this.workers.get(name);
    if (existing) {
      void existing.terminate();
    }
    this.workers.delete(name);

    if (heartbeat?.disabled) {
      this.statuses.set(name, 'disabled');
      return;
    }

    void this.startWorker(name, config);
  }

  async shutdown(): Promise<void> {
    for (const heartbeat of this.heartbeats.values()) {
      heartbeat.stop();
    }
    this.heartbeats.clear();

    for (const [name, worker] of this.workers.entries()) {
      this.statuses.set(name, 'stopped');
      await worker.terminate();
    }
    this.workers.clear();
  }
}
