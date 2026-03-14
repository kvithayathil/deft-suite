import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConsoleLogger } from '../../src/adapters/driven/console-logger.js';

describe('ConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs error messages', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new ConsoleLogger('error');
    logger.error('bad');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('bad'));
  });

  it('respects level gating — debug not shown at info level', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new ConsoleLogger('info');
    logger.debug('hidden');
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows all levels at debug level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new ConsoleLogger('debug');
    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');
    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();
  });
});
