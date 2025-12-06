/**
 * DM Queue Service
 *
 * IndexedDB-based queue for optimistic DM sending with automatic retry.
 * Messages are stored locally and sent with exponential backoff on failure.
 */

import { debug } from "@bsky/shared";

const DB_NAME = "BskyDMQueue";
const DB_VERSION = 1;
const STORE_NAME = "dm_queue";

// DM status states
export type DMStatus = "sending" | "sent" | "failed" | "retrying";

// Optimistic DM interface
export interface OptimisticDM {
  _localId: string;
  _status: DMStatus;
  _retryCount: number;
  _lastError?: string;
  _createdAt: number;
  _nextRetryAt?: number;
  conversationId: string;
  text: string;
  senderDid: string;
  // Server-assigned ID after successful send (for deduplication)
  serverId?: string;
}

export interface DMQueueStats {
  pendingCount: number;
  failedCount: number;
  retryingCount: number;
}

// Retry configuration
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds
const JITTER_FACTOR = 0.1; // 10% jitter

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(retryCount: number): number {
  const baseDelay = Math.min(
    INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount),
    MAX_RETRY_DELAY_MS,
  );
  const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(baseDelay + jitter);
}

/**
 * Generate a unique local ID for optimistic messages
 */
function generateLocalId(): string {
  return `dm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

class DMQueueDB {
  private static instance: DMQueueDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isProcessing = false;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onlineHandler: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();
  private messageExecutor:
    | ((dm: OptimisticDM) => Promise<string | void>)
    | null = null;

  private constructor() {}

  static getInstance(): DMQueueDB {
    if (!DMQueueDB.instance) {
      DMQueueDB.instance = new DMQueueDB();
    }
    return DMQueueDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open DMQueueDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("DMQueueDB initialized");
        this.setupOnlineListener();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "_localId",
          });
          store.createIndex("status", "_status", { unique: false });
          store.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          store.createIndex("createdAt", "_createdAt", { unique: false });
          store.createIndex("nextRetryAt", "_nextRetryAt", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("DMQueueDB not initialized. Call init() first.");
    }
    return this.db;
  }

  private setupOnlineListener(): void {
    if (this.onlineHandler) return;

    this.onlineHandler = () => {
      debug.log("Network restored, processing DM queue...");
      this.processQueue();
    };

    window.addEventListener("online", this.onlineHandler);
  }

  /**
   * Set the message executor function (called to actually send DMs)
   */
  setMessageExecutor(
    executor: (dm: OptimisticDM) => Promise<string | void>,
  ): void {
    this.messageExecutor = executor;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Add a new DM to the queue (optimistic send)
   */
  async enqueue(
    conversationId: string,
    text: string,
    senderDid: string,
  ): Promise<OptimisticDM> {
    const db = this.ensureDb();
    const localId = generateLocalId();

    const dm: OptimisticDM = {
      _localId: localId,
      _status: "sending",
      _retryCount: 0,
      _createdAt: Date.now(),
      conversationId,
      text,
      senderDid,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(dm);

      request.onsuccess = () => {
        debug.log(`Queued DM: ${localId}`);
        this.notifyListeners();
        // Immediately attempt to send
        this.processMessage(dm);
        resolve(dm);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all messages for a conversation (including optimistic ones)
   */
  async getMessagesForConversation(
    conversationId: string,
  ): Promise<OptimisticDM[]> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("conversationId");
      const request = index.getAll(IDBKeyRange.only(conversationId));

      request.onsuccess = () => {
        const messages = request.result as OptimisticDM[];
        // Sort by creation time
        messages.sort((a, b) => a._createdAt - b._createdAt);
        resolve(messages);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single message by local ID
   */
  async getMessage(localId: string): Promise<OptimisticDM | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(localId);

      request.onsuccess = () => {
        resolve((request.result as OptimisticDM) || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<DMQueueStats> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("status");

      const sendingRequest = index.count(IDBKeyRange.only("sending"));
      const retryingRequest = index.count(IDBKeyRange.only("retrying"));
      const failedRequest = index.count(IDBKeyRange.only("failed"));

      let pendingCount = 0;
      let retryingCount = 0;
      let failedCount = 0;

      sendingRequest.onsuccess = () => {
        pendingCount = sendingRequest.result;
      };

      retryingRequest.onsuccess = () => {
        retryingCount = retryingRequest.result;
      };

      failedRequest.onsuccess = () => {
        failedCount = failedRequest.result;
      };

      transaction.oncomplete = () => {
        resolve({
          pendingCount: pendingCount + retryingCount,
          failedCount,
          retryingCount,
        });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Update a message in the queue
   */
  async updateMessage(
    localId: string,
    updates: Partial<OptimisticDM>,
  ): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const dm = getRequest.result as OptimisticDM | undefined;
        if (!dm) {
          resolve();
          return;
        }

        const updated = { ...dm, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          this.notifyListeners();
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Remove a message from the queue
   */
  async remove(localId: string): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(localId);

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark a message as sent (with server ID for deduplication)
   */
  async markAsSent(localId: string, serverId?: string): Promise<void> {
    await this.updateMessage(localId, {
      _status: "sent",
      serverId,
    });
    // Remove from queue after short delay (allows UI to show sent status)
    setTimeout(() => {
      this.remove(localId);
    }, 2000);
  }

  /**
   * Retry sending a failed message manually
   */
  async retryMessage(localId: string): Promise<void> {
    const dm = await this.getMessage(localId);
    if (!dm) return;

    await this.updateMessage(localId, {
      _status: "retrying",
      _retryCount: dm._retryCount,
    });

    await this.processMessage(dm);
  }

  /**
   * Process a single message (attempt to send)
   */
  private async processMessage(dm: OptimisticDM): Promise<void> {
    if (!this.messageExecutor) {
      debug.error("DM message executor not set");
      await this.updateMessage(dm._localId, {
        _status: "failed",
        _lastError: "Message executor not configured",
      });
      return;
    }

    if (!navigator.onLine) {
      // Offline - schedule retry
      await this.scheduleRetry(dm);
      return;
    }

    try {
      const serverId = await this.messageExecutor(dm);
      await this.markAsSent(dm._localId, serverId as string | undefined);
      debug.log(`DM sent successfully: ${dm._localId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isNetworkError = this.isNetworkError(error);

      if (isNetworkError && dm._retryCount < MAX_RETRY_ATTEMPTS) {
        await this.scheduleRetry(dm, errorMessage);
      } else if (dm._retryCount >= MAX_RETRY_ATTEMPTS) {
        // Max retries exceeded
        await this.updateMessage(dm._localId, {
          _status: "failed",
          _lastError: `Max retries exceeded: ${errorMessage}`,
        });
        debug.error(
          `DM failed after ${MAX_RETRY_ATTEMPTS} retries: ${dm._localId}`,
        );
      } else {
        // Non-network error - mark as failed immediately
        await this.updateMessage(dm._localId, {
          _status: "failed",
          _lastError: errorMessage,
        });
        debug.error(`DM failed: ${dm._localId} - ${errorMessage}`);
      }
    }
  }

  /**
   * Schedule a retry for a failed message
   */
  private async scheduleRetry(
    dm: OptimisticDM,
    errorMessage?: string,
  ): Promise<void> {
    const newRetryCount = dm._retryCount + 1;
    const delay = calculateBackoff(newRetryCount);
    const nextRetryAt = Date.now() + delay;

    await this.updateMessage(dm._localId, {
      _status: "retrying",
      _retryCount: newRetryCount,
      _lastError: errorMessage,
      _nextRetryAt: nextRetryAt,
    });

    debug.log(
      `DM ${dm._localId} scheduled for retry ${newRetryCount}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`,
    );

    // Schedule the retry
    this.scheduleNextRetry();
  }

  /**
   * Schedule the next retry timer
   */
  private scheduleNextRetry(): void {
    // Clear existing timer
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    // Find the next message to retry
    this.getNextRetryTime().then((nextRetryAt) => {
      if (nextRetryAt === null) return;

      const delay = Math.max(0, nextRetryAt - Date.now());
      this.retryTimeoutId = setTimeout(() => {
        this.processQueue();
      }, delay);
    });
  }

  /**
   * Get the next retry time from the queue
   */
  private async getNextRetryTime(): Promise<number | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("status");
      const request = index.getAll(IDBKeyRange.only("retrying"));

      request.onsuccess = () => {
        const messages = request.result as OptimisticDM[];
        if (messages.length === 0) {
          resolve(null);
          return;
        }

        const nextRetry = messages.reduce((min, msg) => {
          const retryAt = msg._nextRetryAt || 0;
          return retryAt < min ? retryAt : min;
        }, Infinity);

        resolve(nextRetry === Infinity ? null : nextRetry);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Process all pending and due retries in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) {
      debug.log("Offline, skipping DM queue processing");
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    try {
      const db = this.ensureDb();
      const now = Date.now();

      // Get all retrying messages that are due
      const retryingMessages = await new Promise<OptimisticDM[]>(
        (resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index("status");
          const request = index.getAll(IDBKeyRange.only("retrying"));

          request.onsuccess = () => {
            const messages = (request.result as OptimisticDM[]).filter(
              (msg) => !msg._nextRetryAt || msg._nextRetryAt <= now,
            );
            resolve(messages);
          };

          request.onerror = () => reject(request.error);
        },
      );

      // Also get any messages stuck in "sending" state (e.g., from page refresh)
      const stuckMessages = await new Promise<OptimisticDM[]>(
        (resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index("status");
          const request = index.getAll(IDBKeyRange.only("sending"));

          request.onsuccess = () => {
            // Only process messages that have been stuck for more than 10 seconds
            const stuckThreshold = now - 10000;
            const messages = (request.result as OptimisticDM[]).filter(
              (msg) => msg._createdAt < stuckThreshold,
            );
            resolve(messages);
          };

          request.onerror = () => reject(request.error);
        },
      );

      const allToProcess = [...retryingMessages, ...stuckMessages];

      if (allToProcess.length === 0) {
        debug.log("No DMs to process");
        return;
      }

      debug.log(`Processing ${allToProcess.length} DMs in queue...`);

      for (const dm of allToProcess) {
        if (!navigator.onLine) {
          debug.log("Went offline during DM processing, stopping");
          break;
        }
        await this.processMessage(dm);
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
      // Schedule next retry if needed
      this.scheduleNextRetry();
    }
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: unknown): boolean {
    if (!navigator.onLine) return true;
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }
    if (error instanceof Error) {
      const networkIndicators = [
        "network",
        "fetch",
        "timeout",
        "ECONNREFUSED",
        "ENOTFOUND",
        "offline",
        "NetworkError",
      ];
      return networkIndicators.some((indicator) =>
        error.message.toLowerCase().includes(indicator.toLowerCase()),
      );
    }
    return false;
  }

  /**
   * Check if the queue is currently processing
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear all messages from the queue
   */
  async clearAll(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.notifyListeners();
        debug.log("Cleared all queued DMs");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.listeners.clear();
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }
}

export const dmQueueDB = DMQueueDB.getInstance();
