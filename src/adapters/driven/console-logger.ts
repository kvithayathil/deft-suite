import type { Logger, LogLevel } from '../../core/ports/logger.js';

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export class ConsoleLogger implements Logger {
  private readonly minLevel: number;

  constructor(level: LogLevel = 'info') {
    this.minLevel = LEVEL_ORDER[level];
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  private formatContext(context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }
    return ` ${Object.entries(context).map(([k, v]) => `${k}=${String(v)}`).join(' ')}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] <= this.minLevel) {
      console[level](`[${level.toUpperCase()}] ${message}${this.formatContext(context)}`);
    }
  }
}
