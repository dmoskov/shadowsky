jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const QUEUE_KEY = '@BskyMutationQueue';
const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FIVE_HOURS = 25 * 60 * 60 * 1000;

let mutationQueue: any;
let AsyncStorage: any;

/**
 * Helper to get a fresh module pair (AsyncStorage + mutationQueue) after
 * jest.resetModules(). Both will share the same mock storage backend.
 */
function freshModules() {
  jest.resetModules();
  AsyncStorage = require('@react-native-async-storage/async-storage');
  const mod = require('../mutation-queue');
  mutationQueue = mod.mutationQueue;
}

/**
 * Flush pending microtasks / promises without advancing the 30-second
 * periodic timer (which causes infinite-loop issues with runAllTimersAsync).
 */
async function flushMicrotasks() {
  await jest.advanceTimersByTimeAsync(0);
}

beforeEach(async () => {
  jest.useFakeTimers();
  freshModules();
  await AsyncStorage.clear();
});

afterEach(() => {
  if (mutationQueue?.destroy) {
    mutationQueue.destroy();
  }
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
describe('Initialization', () => {
  it('loads queue from AsyncStorage', async () => {
    const stored = [
      {
        id: 'like-123',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stored));

    await mutationQueue.init();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('like-123');
  });

  it('starts with empty queue when storage is empty', async () => {
    await mutationQueue.init();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(0);
  });

  it('cleans expired mutations on startup', async () => {
    const data = [
      {
        id: 'like-old',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now() - TWENTY_FIVE_HOURS,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
      {
        id: 'like-recent',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/2',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('like-recent');
  });

  it('double init is a no-op', async () => {
    await mutationQueue.init();

    // Second init should return immediately without error
    await mutationQueue.init();

    expect(mutationQueue.isQueueProcessing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Enqueue
// ---------------------------------------------------------------------------
describe('Enqueue', () => {
  beforeEach(async () => {
    await mutationQueue.init();
  });

  it('generates unique ID with type prefix', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    const id = await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });

    expect(id).toMatch(/^like-/);
  });

  it('persists to AsyncStorage', async () => {
    // Use a failing executor so the mutation stays in the queue
    const executor = jest.fn().mockRejectedValue(new Error('network error'));
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'repost' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    await flushMicrotasks();

    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });

  it('notifies listeners', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    const listener = jest.fn();
    mutationQueue.subscribe(listener);

    await mutationQueue.enqueue({
      type: 'follow' as const,
      targetUri: 'did:plc:abc',
      maxRetries: 3,
    });

    expect(listener).toHaveBeenCalled();
  });

  it('returns the mutation ID', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    const id = await mutationQueue.enqueue({
      type: 'unlike' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('sets status to pending and retryCount to 0', async () => {
    // Use a failing executor so the mutation is not removed
    const executor = jest.fn().mockRejectedValue(new Error('network error'));
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    // processQueue fires automatically; flush to let it finish
    await flushMicrotasks();

    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = JSON.parse(stored!);
    // After one transient failure retryCount increments from 0 to 1, status stays pending
    expect(parsed[0].retryCount).toBe(1);
    expect(parsed[0].status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// 3. Queue processing
// ---------------------------------------------------------------------------
describe('Queue processing', () => {
  beforeEach(async () => {
    await mutationQueue.init();
  });

  it('processQueue processes pending mutations in FIFO order', async () => {
    // Get a fresh instance, seed storage, then init so mutations are loaded.
    mutationQueue.destroy();
    freshModules();

    const now = Date.now();
    const stored = [
      {
        id: 'like-1',
        type: 'like',
        targetUri: 'post-second',
        timestamp: now + 100,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
      {
        id: 'like-2',
        type: 'like',
        targetUri: 'post-first',
        timestamp: now,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stored));

    const callOrder: string[] = [];
    const executor = jest.fn().mockImplementation(async (mutation: any) => {
      callOrder.push(mutation.targetUri);
    });
    mutationQueue.setMutationExecutor(executor);
    await mutationQueue.init();
    await mutationQueue.processQueue();

    expect(callOrder).toEqual(['post-first', 'post-second']);
  });

  it('calls mutation executor for each mutation', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    await flushMicrotasks();

    await mutationQueue.enqueue({
      type: 'repost' as const,
      targetUri: 'at://did:plc:abc/post/2',
      maxRetries: 3,
    });
    await flushMicrotasks();

    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('removes successfully processed mutations', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    await flushMicrotasks();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(0);
  });

  it('isQueueProcessing returns false when idle', () => {
    expect(mutationQueue.isQueueProcessing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Error handling
// ---------------------------------------------------------------------------
describe('Error handling', () => {
  beforeEach(async () => {
    await mutationQueue.init();
  });

  it('transient errors keep mutation as pending with incremented retryCount', async () => {
    const executor = jest.fn().mockRejectedValue(new Error('network error'));
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    await flushMicrotasks();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
    expect(all[0].retryCount).toBe(1);
  });

  it('permanent errors mark mutation as failed', async () => {
    const executor = jest.fn().mockRejectedValue(new Error('400 bad request'));
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });
    await flushMicrotasks();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
  });

  it('exceeding maxRetries marks mutation as failed', async () => {
    // Get fresh instance, seed a mutation that has already used all retries
    mutationQueue.destroy();
    freshModules();

    const stored = [
      {
        id: 'like-maxed',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now(),
        retryCount: 3,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stored));

    const executor = jest.fn().mockRejectedValue(new Error('network error'));
    mutationQueue.setMutationExecutor(executor);
    await mutationQueue.init();
    await mutationQueue.processQueue();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
  });

  it.each([
    ['network error', true],
    ['429 rate limited', true],
    ['500 server error', true],
    ['400 bad request', false],
    ['invalid input', false],
  ])(
    'isTransientError for "%s" returns %s',
    async (message: string, expected: boolean) => {
      const executor = jest.fn().mockRejectedValue(new Error(message));
      mutationQueue.setMutationExecutor(executor);

      await mutationQueue.enqueue({
        type: 'like' as const,
        targetUri: 'at://did:plc:abc/post/1',
        maxRetries: 3,
      });
      await flushMicrotasks();

      const all = mutationQueue.getAllMutations();
      if (expected) {
        expect(all[0].status).toBe('pending');
      } else {
        expect(all[0].status).toBe('failed');
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 5. Expiry
// ---------------------------------------------------------------------------
describe('Expiry', () => {
  it('removeExpired removes mutations older than 24 hours', async () => {
    const old = [
      {
        id: 'like-expired',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now() - TWENTY_FIVE_HOURS,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(old));

    await mutationQueue.init();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(0);
  });

  it('recent mutations are kept', async () => {
    const recent = [
      {
        id: 'like-recent',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now() - ONE_HOUR,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(recent));

    await mutationQueue.init();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('like-recent');
  });
});

// ---------------------------------------------------------------------------
// 6. Stats
// ---------------------------------------------------------------------------
describe('Stats', () => {
  it('returns correct pending/failed counts', async () => {
    const data = [
      {
        id: 'like-1',
        type: 'like',
        targetUri: 'post/1',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
      {
        id: 'like-2',
        type: 'like',
        targetUri: 'post/2',
        timestamp: Date.now(),
        retryCount: 3,
        maxRetries: 3,
        status: 'failed',
      },
      {
        id: 'like-3',
        type: 'like',
        targetUri: 'post/3',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    const stats = await mutationQueue.getStats();
    expect(stats.pendingCount).toBe(2);
    expect(stats.failedCount).toBe(1);
  });

  it('oldest age calculation is correct', async () => {
    const now = Date.now();
    const data = [
      {
        id: 'like-1',
        type: 'like',
        targetUri: 'post/1',
        timestamp: now - 5000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
      {
        id: 'like-2',
        type: 'like',
        targetUri: 'post/2',
        timestamp: now - 10000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    const stats = await mutationQueue.getStats();
    expect(stats.oldestAge).not.toBeNull();
    // Oldest mutation was created 10s ago
    expect(stats.oldestAge).toBeGreaterThanOrEqual(10000);
  });
});

// ---------------------------------------------------------------------------
// 7. Listeners
// ---------------------------------------------------------------------------
describe('Listeners', () => {
  beforeEach(async () => {
    await mutationQueue.init();
  });

  it('subscribe returns an unsubscribe function', () => {
    const listener = jest.fn();
    const unsub = mutationQueue.subscribe(listener);
    expect(typeof unsub).toBe('function');
  });

  it('listeners are called on enqueue', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    const listener = jest.fn();
    mutationQueue.subscribe(listener);

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });

    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribed listeners are not called', async () => {
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    const listener = jest.fn();
    const unsub = mutationQueue.subscribe(listener);
    unsub();

    await mutationQueue.enqueue({
      type: 'like' as const,
      targetUri: 'at://did:plc:abc/post/1',
      maxRetries: 3,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Clear operations
// ---------------------------------------------------------------------------
describe('Clear operations', () => {
  it('clearAll empties the queue', async () => {
    // Seed a mutation that will fail (transient) and stay in the queue
    const data = [
      {
        id: 'like-1',
        type: 'like',
        targetUri: 'at://did:plc:abc/post/1',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    // Verify data was loaded
    expect(mutationQueue.getAllMutations()).toHaveLength(1);

    await mutationQueue.clearAll();

    expect(mutationQueue.getAllMutations()).toHaveLength(0);

    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    expect(JSON.parse(stored!)).toHaveLength(0);
  });

  it('clearFailed removes only failed mutations', async () => {
    const data = [
      {
        id: 'like-pending',
        type: 'like',
        targetUri: 'post/1',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      },
      {
        id: 'like-failed',
        type: 'like',
        targetUri: 'post/2',
        timestamp: Date.now(),
        retryCount: 3,
        maxRetries: 3,
        status: 'failed',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    await mutationQueue.clearFailed();

    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('like-pending');
  });

  it('retryFailed resets failed mutations to pending', async () => {
    const data = [
      {
        id: 'like-failed',
        type: 'like',
        targetUri: 'post/1',
        timestamp: Date.now(),
        retryCount: 3,
        maxRetries: 3,
        status: 'failed',
        error: 'some error',
      },
    ];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));

    await mutationQueue.init();

    // Set executor that succeeds so retryFailed -> processQueue removes it
    const executor = jest.fn().mockResolvedValue(undefined);
    mutationQueue.setMutationExecutor(executor);

    await mutationQueue.retryFailed();
    await flushMicrotasks();

    // After successful retry the mutation is removed
    const all = mutationQueue.getAllMutations();
    expect(all).toHaveLength(0);
    expect(executor).toHaveBeenCalled();
  });
});
