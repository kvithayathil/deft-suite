import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerHeartbeat, type HeartbeatTarget } from '../../src/resilience/worker-heartbeat.js';
import { NoopLogger } from '../helpers/noop-logger.js';

class MockWorker implements HeartbeatTarget {
  readonly name = 'test-worker';
  terminated = false;
  private pongHandler: (() => void) | null = null;

  sendPing(): void {
    // Simulate immediate pong by default
  }

  onPong(handler: () => void): void {
    this.pongHandler = handler;
  }

  simulatePong(): void {
    this.pongHandler?.();
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('WorkerHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not terminate healthy workers', () => {
    const worker = new MockWorker();
    const logger = new NoopLogger();
    const heartbeat = new WorkerHeartbeat(worker, logger, {
      pingIntervalMs: 1000,
      pongTimeoutMs: 500,
    });

    heartbeat.start();
    vi.advanceTimersByTime(1000); // Trigger ping
    worker.simulatePong(); // Respond
    vi.advanceTimersByTime(1000); // Next cycle

    expect(worker.terminated).toBe(false);
    heartbeat.stop();
  });

  it('terminates worker after pong timeout', () => {
    const worker = new MockWorker();
    const logger = new NoopLogger();
    const onHung = vi.fn();
    const heartbeat = new WorkerHeartbeat(worker, logger, {
      pingIntervalMs: 1000,
      pongTimeoutMs: 500,
      onHung,
    });

    heartbeat.start();
    vi.advanceTimersByTime(1000); // Trigger ping
    // No pong...
    vi.advanceTimersByTime(500); // Pong timeout

    expect(worker.terminated).toBe(true);
    expect(onHung).toHaveBeenCalledWith('test-worker');
    heartbeat.stop();
  });

  it('disables worker after 3 consecutive restarts within 10 minutes', () => {
    const worker = new MockWorker();
    const logger = new NoopLogger();
    const onHung = vi.fn();
    const heartbeat = new WorkerHeartbeat(worker, logger, {
      pingIntervalMs: 1000,
      pongTimeoutMs: 500,
      onHung,
    });

    heartbeat.start();

    // 3 missed pongs — triggers disable
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(500);
    }

    expect(onHung).toHaveBeenCalledTimes(3);
    expect(heartbeat.disabled).toBe(true);
    // Logger should report the disable
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('disabled') }),
    );
  });

  it('resets consecutive hang count on successful pong', () => {
    const worker = new MockWorker();
    const logger = new NoopLogger();
    const heartbeat = new WorkerHeartbeat(worker, logger, {
      pingIntervalMs: 1000,
      pongTimeoutMs: 500,
    });

    heartbeat.start();

    // Miss one pong
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);

    // Recover — next cycle gets a pong
    vi.advanceTimersByTime(1000);
    worker.simulatePong();

    // Miss two more — should NOT disable (only 2 in window after reset)
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);

    expect(heartbeat.disabled).toBe(false);
    heartbeat.stop();
  });

  it('stop clears all intervals', () => {
    const worker = new MockWorker();
    const heartbeat = new WorkerHeartbeat(worker, new NoopLogger(), {
      pingIntervalMs: 1000,
      pongTimeoutMs: 500,
    });

    heartbeat.start();
    heartbeat.stop();

    // Should not trigger any callbacks after stop
    vi.advanceTimersByTime(10000);
    expect(worker.terminated).toBe(false);
  });
});
