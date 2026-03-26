import { parentPort } from 'node:worker_threads';
import type { WorkerMessage } from './messages.js';

interface Source {
  type: string;
  url?: string;
  path?: string;
}

interface LocalSourceConfig {
  path: string;
  sync?: string;
}

interface RemoteSourceConfig {
  url: string;
  type: string;
}

interface SourcesConfig {
  local?: LocalSourceConfig[];
  remote?: RemoteSourceConfig[];
}

interface SyncSettings {
  intervalMinutes: number;
  autoUpdate: boolean;
}

interface FullConfig {
  sync?: SyncSettings;
  sources?: SourcesConfig;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

function flattenSources(sources: SourcesConfig): Source[] {
  const result: Source[] = [];
  for (const local of sources.local ?? []) {
    result.push({ type: local.sync === 'git' ? 'git' : 'local', path: local.path });
  }
  for (const remote of sources.remote ?? []) {
    result.push({ type: remote.type, url: remote.url });
  }
  return result;
}

function startSyncLoop(intervalMinutes: number, sources: Source[]): void {
  const intervalMs = intervalMinutes * 60 * 1000;

  const runSync = (): void => {
    const updated: string[] = [];
    for (const source of sources) {
      if (source.type === 'git' || source.type === 'hosted') {
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
      const config = msg.config as FullConfig;
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      if (config.sync) {
        startSyncLoop(config.sync.intervalMinutes, flattenSources(config.sources ?? {}));
      }
      parentPort!.postMessage({ type: 'ready' } satisfies WorkerMessage);
    }
  });
}
