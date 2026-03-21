import { describe, it, expect, afterEach } from 'vitest';
import { WorkerManager } from '../../src/workers/worker-manager.js';
import { NoopLogger } from '../helpers/noop-logger.js';

describe('WorkerManager', () => {
  let manager: WorkerManager | undefined;

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
      manager = undefined;
    }
  });

  it('creates manager without starting workers', () => {
    const logger = new NoopLogger();
    manager = new WorkerManager(logger);
    expect(manager.getWorkerStatus()).toEqual({
      sync: 'stopped',
      scanner: 'stopped',
      index: 'stopped',
    });
  });

  it('reports worker status shape', () => {
    const logger = new NoopLogger();
    manager = new WorkerManager(logger, { autoStart: false });
    const status = manager.getWorkerStatus();
    expect(status).toHaveProperty('sync');
    expect(status).toHaveProperty('scanner');
    expect(status).toHaveProperty('index');
  });
});
