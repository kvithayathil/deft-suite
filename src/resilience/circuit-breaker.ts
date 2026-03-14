export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half-open',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

const DEFAULTS: Required<CircuitBreakerOptions> = {
  failureThreshold: 3,
  cooldownMs: 300_000, // 5 minutes
};

export class CircuitBreaker {
  private state = CircuitState.Closed;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options?: CircuitBreakerOptions) {
    this.options = { ...DEFAULTS, ...options };
  }

  getState(): CircuitState {
    if (this.state === CircuitState.Open && this.cooldownElapsed()) {
      this.state = CircuitState.HalfOpen;
    }
    return this.state;
  }

  isAllowed(): boolean {
    const state = this.getState();
    return state === CircuitState.Closed || state === CircuitState.HalfOpen;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === CircuitState.HalfOpen) {
      this.state = CircuitState.Closed;
      this.openedAt = null;
    }
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === CircuitState.HalfOpen) {
      this.trip();
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = CircuitState.Open;
    this.openedAt = Date.now();
  }

  private cooldownElapsed(): boolean {
    if (this.openedAt === null) return false;
    return Date.now() - this.openedAt >= this.options.cooldownMs;
  }
}
