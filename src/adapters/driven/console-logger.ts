import type { Logger, LogLevel } from '../../core/ports/logger.js';

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export class ConsoleLogger implements Logger {
  private readonly minLevel: number;

  constructor(level: LogLevel = 'info') {
    this.minLevel = LEVEL_ORDER[level];
  }

  error(message: string): void {
    this.log('error', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  info(message: string): void {
    this.log('info', message);
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  private log(level: LogLevel, message: string): void {
    if (LEVEL_ORDER[level] <= this.minLevel) {
      console[level](`[${level.toUpperCase()}] ${message}`);
    }
  }
}
