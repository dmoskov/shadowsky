import {
  ATProtoRateLimiter,
  ATProtoEndpointType,
  CircuitBreakerState,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  rateLimited,
} from '../rate-limiter';

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../../utils/with-timeout', () => ({
  withTimeout: jest.fn((fn: () => Promise<any>) => fn()),
}));

// ─── Fake timers ───────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  resetGlobalRateLimiter();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── TokenBucket (via ATProtoRateLimiter) ──────────────────

describe('TokenBucket (via ATProtoRateLimiter)', () => {
  it('waitForAllowance passes immediately when tokens available', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 5, refillRate: 1, refillInterval: 1000},
    });

    await expect(limiter.waitForAllowance(ATProtoEndpointType.FEED)).resolves.toBeUndefined();
  });

  it('after exhausting tokens, request is queued', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 1, refillRate: 1, refillInterval: 1000},
    });

    await limiter.waitForAllowance(ATProtoEndpointType.FEED);

    let resolved = false;
    const promise = limiter.waitForAllowance(ATProtoEndpointType.FEED).then(() => {
      resolved = true;
    });

    // Should not have resolved yet (no tokens)
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Advance time so a token refills
    jest.advanceTimersByTime(1000);
    await promise;
    expect(resolved).toBe(true);
  });

  it('tokens refill over time', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 2, refillRate: 1, refillInterval: 1000},
    });

    // Exhaust both tokens
    await limiter.waitForAllowance(ATProtoEndpointType.FEED);
    await limiter.waitForAllowance(ATProtoEndpointType.FEED);

    // Advance time for refill
    jest.advanceTimersByTime(2000);

    // Should be able to acquire 2 more tokens after refill
    await expect(limiter.waitForAllowance(ATProtoEndpointType.FEED)).resolves.toBeUndefined();
    await expect(limiter.waitForAllowance(ATProtoEndpointType.FEED)).resolves.toBeUndefined();
  });

  it('queue timeout rejects after specified timeout', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 1, refillRate: 1, refillInterval: 60000},
    });

    // Exhaust the single token
    await limiter.waitForAllowance(ATProtoEndpointType.FEED);

    // Queue a request with a short timeout
    const promise = limiter.waitForAllowance(ATProtoEndpointType.FEED, 500);

    jest.advanceTimersByTime(500);

    await expect(promise).rejects.toThrow('Rate limit queue timeout after 500ms');
  });
});

// ─── ATProtoRateLimiter construction ───────────────────────

describe('ATProtoRateLimiter construction', () => {
  it('creates buckets for all endpoint types', () => {
    const limiter = new ATProtoRateLimiter();

    const allMetrics = limiter.getAllMetrics();
    const types = Object.values(ATProtoEndpointType);

    for (const type of types) {
      expect(allMetrics[type]).toBeDefined();
      expect(allMetrics[type].tokensRemaining).toBeGreaterThan(0);
    }
  });

  it('custom config overrides defaults', () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 10, refillRate: 1, refillInterval: 500},
    });

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics).not.toBeNull();
    expect(metrics!.tokensRemaining).toBe(10);
  });
});

// ─── waitForAllowance ──────────────────────────────────────

describe('waitForAllowance', () => {
  it('passes when tokens available', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.RECORD]: {capacity: 5, refillRate: 1, refillInterval: 1000},
    });

    await expect(limiter.waitForAllowance(ATProtoEndpointType.RECORD)).resolves.toBeUndefined();
  });

  it('unknown endpoint type does not throw (just warns)', async () => {
    const limiter = new ATProtoRateLimiter();

    await expect(
      limiter.waitForAllowance('unknown_endpoint' as ATProtoEndpointType),
    ).resolves.toBeUndefined();
  });

  it('high-capacity endpoint (FEED=300) allows many quick requests', async () => {
    const limiter = new ATProtoRateLimiter();

    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(limiter.waitForAllowance(ATProtoEndpointType.FEED));
    }

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});

// ─── 429 tracking & adaptive mode ──────────────────────────

describe('429 tracking & adaptive mode', () => {
  it('single 429 does not trigger adaptive mode', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(false);
    expect(status.circuitState).toBe(CircuitBreakerState.CLOSED);
  });

  it('two 429s in 60s do not trigger adaptive mode', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(false);
    expect(status.circuitState).toBe(CircuitBreakerState.CLOSED);
  });

  it('three 429s in 60s trigger adaptive mode (circuit state OPEN)', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(true);
    expect(status.circuitState).toBe(CircuitBreakerState.OPEN);
  });

  it('429s more than 60s apart reset the counter', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    // Advance past the 60s window
    jest.advanceTimersByTime(61000);

    // This should reset the counter; now count = 1
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(false);
    expect(status.recent429Count).toBe(1);
  });

  it('after adaptive mode, getAdaptiveStatus shows isActive=true', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.RECORD);
    limiter.track429Error(ATProtoEndpointType.NOTIFICATION);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(true);
    expect(status.remainingTimeMs).toBeGreaterThan(0);
  });
});

// ─── Circuit breaker ───────────────────────────────────────

describe('Circuit breaker', () => {
  it('initial state is CLOSED', () => {
    const limiter = new ATProtoRateLimiter();

    const status = limiter.getAdaptiveStatus();
    expect(status.circuitState).toBe(CircuitBreakerState.CLOSED);
  });

  it('after 3 429s: state is OPEN', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.OPEN);
  });

  it('after probe timer fires (advance 30s): state is HALF_OPEN', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.OPEN);

    // Advance past the initial probe interval (30s)
    jest.advanceTimersByTime(30000);

    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('in HALF_OPEN, trackSuccess() transitions to CLOSED (recovery)', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    jest.advanceTimersByTime(30000);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);

    limiter.trackSuccess();

    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.CLOSED);
    expect(limiter.getAdaptiveStatus().isActive).toBe(false);
  });

  it('in HALF_OPEN, track429Error stays OPEN with backoff', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    jest.advanceTimersByTime(30000);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);

    // Probe failure while half-open
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.circuitState).toBe(CircuitBreakerState.OPEN);
    expect(status.consecutiveProbeFailures).toBe(1);
  });

  it('probe failure doubles next probe interval', () => {
    const limiter = new ATProtoRateLimiter();

    // Trigger adaptive mode
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    // First probe at 30s
    jest.advanceTimersByTime(30000);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);

    // Fail the probe -> next interval = 60s
    limiter.track429Error(ATProtoEndpointType.FEED);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.OPEN);

    // Second probe at 60s
    jest.advanceTimersByTime(60000);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);

    // Fail again -> next interval = 120s
    limiter.track429Error(ATProtoEndpointType.FEED);
    expect(limiter.getAdaptiveStatus().consecutiveProbeFailures).toBe(2);

    // Third probe at 120s
    jest.advanceTimersByTime(120000);
    expect(limiter.getAdaptiveStatus().circuitState).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('probe interval capped at 5 minutes (300000ms)', () => {
    const limiter = new ATProtoRateLimiter();

    // Trigger adaptive mode
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    // Backoff sequence: 30s -> 60s -> 120s -> 240s -> capped at 300s
    // Fail probes to escalate the backoff until it exceeds the 300s cap
    jest.advanceTimersByTime(30000); // probe 1 fires, next = 60s
    limiter.track429Error(ATProtoEndpointType.FEED);

    jest.advanceTimersByTime(60000); // probe 2 fires, next = 120s
    limiter.track429Error(ATProtoEndpointType.FEED);

    jest.advanceTimersByTime(120000); // probe 3 fires, next = 240s
    limiter.track429Error(ATProtoEndpointType.FEED);

    jest.advanceTimersByTime(240000); // probe 4 fires, next = min(480s, 300s) = 300s
    limiter.track429Error(ATProtoEndpointType.FEED);

    // Verify the next probe is scheduled at the capped interval (300s = 300000ms),
    // not the uncapped 480s. nextProbeMs tells us how far away the next probe is.
    const status = limiter.getAdaptiveStatus();
    expect(status.consecutiveProbeFailures).toBe(4);
    // nextProbeMs should be approximately 300000ms (the cap), not 480000ms
    expect(status.nextProbeMs).toBeGreaterThan(299000);
    expect(status.nextProbeMs).toBeLessThanOrEqual(300000);
  });
});

// ─── parseRateLimitHeaders ─────────────────────────────────

describe('parseRateLimitHeaders', () => {
  it('parses ratelimit-limit, ratelimit-remaining, ratelimit-reset headers', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.parseRateLimitHeaders(ATProtoEndpointType.FEED, {
      'ratelimit-limit': '3000',
      'ratelimit-remaining': '2500',
      'ratelimit-reset': '1700000000',
    });

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics).not.toBeNull();
    expect(metrics!.headerMetrics).toBeDefined();
    expect(metrics!.headerMetrics!.limit).toBe(3000);
    expect(metrics!.headerMetrics!.remaining).toBe(2500);
    expect(metrics!.headerMetrics!.reset).toBe(1700000000);
  });

  it('parses retry-after header', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.parseRateLimitHeaders(ATProtoEndpointType.FEED, {
      'retry-after': '30',
    });

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics!.headerMetrics).toBeDefined();
    expect(metrics!.headerMetrics!.retryAfter).toBe(30);
  });

  it('no headers results in no tracking', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.parseRateLimitHeaders(ATProtoEndpointType.FEED, {});

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics).not.toBeNull();
    expect(metrics!.headerMetrics).toBeUndefined();
  });
});

// ─── getMetrics ────────────────────────────────────────────

describe('getMetrics', () => {
  it('returns correct metrics for endpoint', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 5, refillRate: 1, refillInterval: 1000},
    });

    await limiter.waitForAllowance(ATProtoEndpointType.FEED);

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics).not.toBeNull();
    expect(metrics!.totalRequests).toBe(1);
    expect(metrics!.tokensRemaining).toBe(4);
  });

  it('returns null for unknown endpoint', () => {
    const limiter = new ATProtoRateLimiter();

    const metrics = limiter.getMetrics('nonexistent' as ATProtoEndpointType);
    expect(metrics).toBeNull();
  });

  it('getAllMetrics returns all endpoints', () => {
    const limiter = new ATProtoRateLimiter();

    const allMetrics = limiter.getAllMetrics();
    const types = Object.values(ATProtoEndpointType);

    expect(Object.keys(allMetrics)).toHaveLength(types.length);
    for (const type of types) {
      expect(allMetrics[type]).toBeDefined();
    }
  });
});

// ─── getAdaptiveStatus ─────────────────────────────────────

describe('getAdaptiveStatus', () => {
  it('not active initially', () => {
    const limiter = new ATProtoRateLimiter();

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(false);
    expect(status.recent429Count).toBe(0);
    expect(status.circuitState).toBe(CircuitBreakerState.CLOSED);
    expect(status.consecutiveProbeFailures).toBe(0);
  });

  it('active after enabling adaptive mode', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(true);
    expect(status.recent429Count).toBe(3);
    expect(status.circuitState).toBe(CircuitBreakerState.OPEN);
  });

  it('shows consecutive probe failures', () => {
    const limiter = new ATProtoRateLimiter();

    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);

    // First probe
    jest.advanceTimersByTime(30000);
    limiter.track429Error(ATProtoEndpointType.FEED);

    // Second probe
    jest.advanceTimersByTime(60000);
    limiter.track429Error(ATProtoEndpointType.FEED);

    const status = limiter.getAdaptiveStatus();
    expect(status.consecutiveProbeFailures).toBe(2);
  });
});

// ─── Reset ─────────────────────────────────────────────────

describe('Reset', () => {
  it('reset() resets single endpoint', async () => {
    const limiter = new ATProtoRateLimiter({
      [ATProtoEndpointType.FEED]: {capacity: 2, refillRate: 1, refillInterval: 1000},
    });

    await limiter.waitForAllowance(ATProtoEndpointType.FEED);
    await limiter.waitForAllowance(ATProtoEndpointType.FEED);

    limiter.reset(ATProtoEndpointType.FEED);

    const metrics = limiter.getMetrics(ATProtoEndpointType.FEED);
    expect(metrics!.totalRequests).toBe(0);
    expect(metrics!.throttledRequests).toBe(0);
    expect(metrics!.tokensRemaining).toBe(2);
  });

  it('resetAll() resets all endpoints and adaptive state', () => {
    const limiter = new ATProtoRateLimiter();

    // Trigger adaptive mode
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    limiter.track429Error(ATProtoEndpointType.FEED);
    expect(limiter.getAdaptiveStatus().isActive).toBe(true);

    limiter.resetAll();

    const status = limiter.getAdaptiveStatus();
    expect(status.isActive).toBe(false);
    expect(status.recent429Count).toBe(0);
    expect(status.circuitState).toBe(CircuitBreakerState.CLOSED);
    expect(status.consecutiveProbeFailures).toBe(0);

    const allMetrics = limiter.getAllMetrics();
    for (const key of Object.keys(allMetrics)) {
      expect(allMetrics[key].totalRequests).toBe(0);
    }
  });
});

// ─── Singleton ─────────────────────────────────────────────

describe('Singleton', () => {
  it('getGlobalRateLimiter returns same instance', () => {
    const a = getGlobalRateLimiter();
    const b = getGlobalRateLimiter();

    expect(a).toBe(b);
  });

  it('resetGlobalRateLimiter creates new instance', () => {
    const a = getGlobalRateLimiter();

    resetGlobalRateLimiter();

    const b = getGlobalRateLimiter();
    expect(a).not.toBe(b);
  });
});

// ─── rateLimited wrapper ───────────────────────────────────

describe('rateLimited wrapper', () => {
  it('calls fn and returns result on success', async () => {
    const fn = jest.fn().mockResolvedValue('result');

    const result = await rateLimited(fn, ATProtoEndpointType.FEED);

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('reports success to circuit breaker (trackSuccess)', async () => {
    const limiter = getGlobalRateLimiter();
    const spy = jest.spyOn(limiter, 'trackSuccess');

    await rateLimited(() => Promise.resolve('ok'), ATProtoEndpointType.FEED);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('tracks 429 errors', async () => {
    const limiter = getGlobalRateLimiter();
    const spy = jest.spyOn(limiter, 'track429Error');

    const error = new Error('429 Too Many Requests');
    (error as any).status = 429;

    await expect(
      rateLimited(() => Promise.reject(error), ATProtoEndpointType.FEED),
    ).rejects.toThrow('429');

    expect(spy).toHaveBeenCalledWith(ATProtoEndpointType.FEED);
    spy.mockRestore();
  });

  it('re-throws errors', async () => {
    const error = new Error('network failure');

    await expect(
      rateLimited(() => Promise.reject(error), ATProtoEndpointType.FEED),
    ).rejects.toThrow('network failure');
  });
});
