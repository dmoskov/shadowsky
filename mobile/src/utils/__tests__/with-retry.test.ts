import {withRetry} from '../with-retry';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─── Happy path ──────────────────────────────────────────

describe('happy path', () => {
  it('succeeds on first try and returns result', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds after one retry', async () => {
    const error = new Error('Server Error') as any;
    error.status = 500;

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── Non-retryable errors ────────────────────────────────

describe('non-retryable errors', () => {
  it.each([400, 401, 403, 404])('throws immediately for status %i', async (status) => {
    const error = new Error(`Error ${status}`) as any;
    error.status = status;

    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toThrow(`Error ${status}`);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── Retryable errors ────────────────────────────────────

describe('retryable errors', () => {
  it('retries on 429 and succeeds', async () => {
    const error = new Error('Rate limited') as any;
    error.status = 429;

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 and succeeds', async () => {
    const error = new Error('Internal Server Error') as any;
    error.status = 500;

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 502 and succeeds', async () => {
    const error = new Error('Bad Gateway') as any;
    error.status = 502;

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 and succeeds', async () => {
    const error = new Error('Service Unavailable') as any;
    error.status = 503;

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── Network errors ──────────────────────────────────────

describe('network errors', () => {
  it('retries on TypeError (network error)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on AbortError', async () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on error message containing "timeout"', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on error message containing "ECONNREFUSED"', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:443'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── Max retries ─────────────────────────────────────────

describe('max retries', () => {
  it('exhausts all retries then throws the last error', async () => {
    const makeError = () => {
      const e = new Error('Server Error') as any;
      e.status = 500;
      return e;
    };

    const fn = jest.fn().mockImplementation(() => Promise.reject(makeError()));

    const promise = withRetry(fn, {maxRetries: 3, baseDelay: 1000}).catch((e: Error) => e);

    // 3 retry delays: 1000, 2000, 4000
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Server Error');
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('honors custom maxRetries', async () => {
    const makeError = () => {
      const e = new Error('Server Error') as any;
      e.status = 500;
      return e;
    };

    const fn = jest.fn().mockImplementation(() => Promise.reject(makeError()));

    const promise = withRetry(fn, {maxRetries: 1, baseDelay: 1000}).catch((e: Error) => e);

    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Server Error');
    expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });
});

// ─── Retry-After header ──────────────────────────────────

describe('Retry-After header', () => {
  it('uses Retry-After seconds header for delay', async () => {
    const error = new Error('Rate limited') as any;
    error.status = 429;
    error.headers = {'retry-after': '5'};

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});

    // Should wait 5000ms (from Retry-After: 5), not the default baseDelay
    await jest.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After HTTP date header for delay', async () => {
    const futureDate = new Date(Date.now() + 3000);
    const error = new Error('Rate limited') as any;
    error.status = 429;
    error.headers = {'retry-after': futureDate.toUTCString()};

    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000});

    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── onRetry callback ────────────────────────────────────

describe('onRetry callback', () => {
  it('is called with correct attempt number, error, and delay', async () => {
    const error = new Error('Server Error') as any;
    error.status = 500;

    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {baseDelay: 1000, onRetry});
    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1000);
    expect(onRetry.mock.calls[0][1].message).toBe('Server Error');
  });
});

// ─── Exponential backoff ─────────────────────────────────

describe('backoff', () => {
  it('delay increases exponentially: baseDelay, baseDelay*2, baseDelay*4', async () => {
    const error = new Error('Server Error') as any;
    error.status = 500;

    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {maxRetries: 3, baseDelay: 1000, onRetry});

    // attempt 0: delay = 1000 * 2^0 + 0 jitter = 1000
    await jest.advanceTimersByTimeAsync(1000);
    // attempt 1: delay = 1000 * 2^1 + 0 jitter = 2000
    await jest.advanceTimersByTimeAsync(2000);
    // attempt 2: delay = 1000 * 2^2 + 0 jitter = 4000
    await jest.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result).toBe('ok');

    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls[0][2]).toBe(1000); // attempt 0
    expect(onRetry.mock.calls[1][2]).toBe(2000); // attempt 1
    expect(onRetry.mock.calls[2][2]).toBe(4000); // attempt 2
  });
});
