import type { Logger } from '../core/ports/logger.js';

export interface HeartbeatTarget {
  readonly name: string;
  sendPing(): void;
  onPong(handler: () => void): void;
  terminate(): void;
}

export interface HeartbeatOptions {
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
  onHung?: (workerName: string) => void;
}

const DEFAULTS = {
  pingIntervalMs: 10_000,
  pongTimeoutMs: 5_000,
};

export class WorkerHeartbeat {
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private waitingForPong = false;
  private consecutiveHangs = 0;
  private hangTimestamps: number[] = [];
  private _disabled = false;
  private readonly options: Required<Omit<HeartbeatOptions, 'onHung'>> & { onHung?: (name: string) => void };

  // After 3 consecutive restarts within 10 minutes, disable the worker for the session (spec §8a)
  private static readonly MAX_RESTARTS = 3;
  private static readonly RESTART_WINDOW_MS = 10 * 60 * 1000;

  constructor(
    private readonly target: HeartbeatTarget,
    private readonly logger: Logger,
    options?: HeartbeatOptions,
  ) {
    this.options = {
      pingIntervalMs: options?.pingIntervalMs ?? DEFAULTS.pingIntervalMs,
      pongTimeoutMs: options?.pongTimeoutMs ?? DEFAULTS.pongTimeoutMs,
      onHung: options?.onHung,
    };

    this.target.onPong(() => this.handlePong());
  }

  get disabled(): boolean { return this._disabled; }

  start(): void {
    if (this._disabled) {
      this.logger.warn(`Worker '${this.target.name}' is disabled — not starting heartbeat`);
      return;
    }
    this.pingInterval = setInterval(() => this.sendPing(), this.options.pingIntervalMs);
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.waitingForPong = false;
  }

  private sendPing(): void {
    if (this.waitingForPong) {
      // Previous pong not yet received; pong timeout will handle the hung detection
      return;
    }

    this.waitingForPong = true;
    this.target.sendPing();

    this.pongTimer = setTimeout(() => {
      if (this.waitingForPong) {
        this.handleHung();
      }
    }, this.options.pongTimeoutMs);
  }

  private handlePong(): void {
    this.waitingForPong = false;
    this.consecutiveHangs = 0;
    this.hangTimestamps = [];
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    // Restart the ping interval from now so the next ping cycle is relative to this pong
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => this.sendPing(), this.options.pingIntervalMs);
    }
  }

  private handleHung(): void {
    this.waitingForPong = false;
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.consecutiveHangs++;

    // Terminate the hung worker (spec §8a)
    this.target.terminate();
    this.logger.warn(`Worker '${this.target.name}' terminated after missed heartbeat (hang #${this.consecutiveHangs})`);

    // Track restart timestamps for the "within 10 minutes" window check
    const now = Date.now();
    this.hangTimestamps.push(now);
    // Keep only timestamps within the restart window
    this.hangTimestamps = this.hangTimestamps.filter(
      t => now - t < WorkerHeartbeat.RESTART_WINDOW_MS,
    );

    // Disable after MAX_RESTARTS consecutive hangs (no successful pong between them) within the window (spec §8a)
    if (
      this.consecutiveHangs >= WorkerHeartbeat.MAX_RESTARTS &&
      this.hangTimestamps.length >= WorkerHeartbeat.MAX_RESTARTS
    ) {
      this._disabled = true;
      this.stop();
      this.logger.error(`Worker '${this.target.name}' disabled — ${WorkerHeartbeat.MAX_RESTARTS} consecutive restarts within 10 minutes`);
    }

    this.options.onHung?.(this.target.name);
  }
}
