import {TimeoutError, withTimeout, fetchWithTimeout} from '../with-timeout';

// ─── Fake timers ───────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── TimeoutError ──────────────────────────────────────────

describe('TimeoutError', () => {
  it('has correct name', () => {
    const err = new TimeoutError(5000);
    expect(err.name).toBe('TimeoutError');
  });

  it('has correct message format', () => {
    const err = new TimeoutError(3000);
    expect(err.message).toBe('Request timed out after 3000ms');
  });

  it('is an instance of Error', () => {
    const err = new TimeoutError(1000);
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── withTimeout ───────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves when fn completes before timeout', async () => {
    const fn = () => Promise.resolve('done');
    const promise = withTimeout(fn, 5000);

    jest.advanceTimersByTime(1);
    await expect(promise).resolves.toBe('done');
  });

  it('rejects with TimeoutError when fn takes too long', async () => {
    const fn = () => new Promise<string>(() => {}); // never resolves
    const promise = withTimeout(fn, 3000);

    jest.advanceTimersByTime(3000);
    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('Request timed out after 3000ms');
  });

  it('passes through fn rejection', async () => {
    const fn = () => Promise.reject(new Error('network failure'));
    const promise = withTimeout(fn, 5000);

    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('network failure');
    await expect(promise).rejects.not.toBeInstanceOf(TimeoutError);
  });

  it('clears timer on success so no timers linger', async () => {
    const fn = () => Promise.resolve(42);
    const promise = withTimeout(fn, 5000);

    jest.advanceTimersByTime(1);
    await promise;

    expect(jest.getTimerCount()).toBe(0);
  });
});

// ─── fetchWithTimeout ──────────────────────────────────────

describe('fetchWithTimeout', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('returns response on successful fetch', async () => {
    const fakeResponse = new Response('ok', {status: 200});
    mockFetch.mockResolvedValue(fakeResponse);

    const promise = fetchWithTimeout('https://example.com');
    jest.advanceTimersByTime(1);
    const result = await promise;

    expect(result).toBe(fakeResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it('throws TimeoutError when fetch times out', async () => {
    mockFetch.mockImplementation((_input: any, init: any) => {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    });

    const promise = fetchWithTimeout('https://example.com', undefined, 5000);
    jest.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('Request timed out after 5000ms');
  });

  it('passes through non-abort errors unchanged', async () => {
    const networkError = new Error('DNS resolution failed');
    mockFetch.mockRejectedValue(networkError);

    const promise = fetchWithTimeout('https://example.com');
    jest.advanceTimersByTime(1);

    await expect(promise).rejects.toThrow('DNS resolution failed');
    await expect(promise).rejects.not.toBeInstanceOf(TimeoutError);
  });

  it('uses default timeout of 15000ms', async () => {
    mockFetch.mockImplementation((_input: any, init: any) => {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    });

    const promise = fetchWithTimeout('https://example.com');

    // Should NOT have timed out at 14999ms
    jest.advanceTimersByTime(14999);

    // Verify still pending — advance the final ms to trigger
    jest.advanceTimersByTime(1);

    await expect(promise).rejects.toThrow('Request timed out after 15000ms');
  });

  it('respects custom timeout value', async () => {
    mockFetch.mockImplementation((_input: any, init: any) => {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    });

    const promise = fetchWithTimeout('https://example.com', undefined, 8000);

    jest.advanceTimersByTime(8000);

    await expect(promise).rejects.toThrow('Request timed out after 8000ms');
  });
});
