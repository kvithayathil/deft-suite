import type { Logger } from '../../src/core/ports/logger.js';

export class NoopLogger implements Logger {
  readonly messages: Array<{ level: string; message: string; context?: Record<string, unknown> }> =
    [];

  error(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'error', message, context });
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'warn', message, context });
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'info', message, context });
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'debug', message, context });
  }
}
