/**
 * Tests for error tracking system
 */

import { errorTracker, trackError, trackAsync, wrapWithTracking } from '../error-tracking';

describe('Error Tracking', () => {
  // Mock console methods
  const originalConsoleGroup = console.group;
  const originalConsoleGroupEnd = console.groupEnd;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    console.group = jest.fn();
    console.groupEnd = jest.fn();
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.group = originalConsoleGroup;
    console.groupEnd = originalConsoleGroupEnd;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    jest.clearAllMocks();
  });

  describe('trackError', () => {
    it('should track errors with correct formatting', () => {
      const error = new Error('Test error');
      trackError(error, { category: 'network', action: 'fetchData' });

      expect(console.group).toHaveBeenCalledWith(
        expect.stringContaining('[NETWORK]'),
        expect.stringContaining('color: #ff8800')
      );
      expect(console.error).toHaveBeenCalledWith(
        '%cError:',
        'font-weight: bold',
        'Test error'
      );
      expect(console.log).toHaveBeenCalledWith(
        '%cAction:',
        'font-weight: bold',
        'fetchData'
      );
      expect(console.groupEnd).toHaveBeenCalled();
    });

    it('should handle auth errors with hints', () => {
      const error = new Error('Session expired');
      trackError(error, { category: 'auth' });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Try logging out and back in'),
        expect.any(String)
      );
    });

    it('should handle rate limit errors with hints', () => {
      const error = new Error('429 Too Many Requests');
      trackError(error, { category: 'network' });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('rate limit'),
        expect.any(String)
      );
    });

    it('should include metadata when provided', () => {
      const error = new Error('Test error');
      const metadata = { userId: '123', endpoint: '/api/test' };
      trackError(error, { category: 'data', metadata });

      expect(console.log).toHaveBeenCalledWith(
        '%cMetadata:',
        'font-weight: bold',
        metadata
      );
    });

    it('should handle non-Error objects', () => {
      trackError('String error', { category: 'unknown' });

      expect(console.error).toHaveBeenCalledWith(
        '%cError:',
        'font-weight: bold',
        'String error'
      );
    });
  });

  describe('trackAsync', () => {
    it('should track async operation errors', async () => {
      const error = new Error('Async error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        trackAsync(operation, { category: 'network', action: 'asyncFetch' })
      ).rejects.toThrow('Async error');

      expect(console.group).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '%cError:',
        'font-weight: bold',
        'Async error'
      );
    });

    it('should not track successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await trackAsync(operation, { category: 'network' });

      expect(result).toBe('success');
      expect(console.group).not.toHaveBeenCalled();
    });
  });

  describe('wrapWithTracking', () => {
    it('should wrap synchronous functions', () => {
      const error = new Error('Sync error');
      const fn = jest.fn().mockImplementation(() => {
        throw error;
      });

      const wrapped = wrapWithTracking(fn, { category: 'ui' });

      expect(() => wrapped('arg1', 'arg2')).toThrow('Sync error');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(console.group).toHaveBeenCalled();
    });

    it('should wrap async functions', async () => {
      const error = new Error('Async error');
      const fn = jest.fn().mockRejectedValue(error);

      const wrapped = wrapWithTracking(fn, { category: 'ui' });

      await expect(wrapped()).rejects.toThrow('Async error');
      expect(console.group).toHaveBeenCalled();
    });

    it('should preserve function name in tracking', () => {
      const namedFunction = function testFunction() {
        throw new Error('Test');
      };

      const wrapped = wrapWithTracking(namedFunction, { category: 'ui' });

      expect(() => wrapped()).toThrow();
      expect(console.log).toHaveBeenCalledWith(
        '%cAction:',
        'font-weight: bold',
        'testFunction'
      );
    });
  });

  describe('error categories', () => {
    it('should use correct colors for each category', () => {
      const categories = [
        { category: 'auth' as const, color: '#ff4444' },
        { category: 'network' as const, color: '#ff8800' },
        { category: 'ui' as const, color: '#ffdd00' },
        { category: 'data' as const, color: '#ff00ff' },
        { category: 'unknown' as const, color: '#888888' }
      ];

      categories.forEach(({ category, color }) => {
        trackError(new Error('Test'), { category });
        expect(console.group).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(`color: ${color}`)
        );
        jest.clearAllMocks();
      });
    });
  });
});