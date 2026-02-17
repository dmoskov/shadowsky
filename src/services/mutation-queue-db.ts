/**
 * Offline Mutation Queue Database
 *
 * Minimal IndexedDB-based queue for storing user mutations (likes, follows, reposts)
 * when connectivity issues occur. Auto-retries when connection is restored.
 *
 * This is a stability feature, not full offline support.
 */

import { debug } from "@bsky/shared";

const DB_NAME = "BskyMutationQueue";
const DB_VERSION = 1;
const STORE_NAME = "mutations";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours - mutations older than this are discarded

// Mutation types supported
export type MutationType =
  | "like"
  | "unlike"
  | "repost"
  | "unrepost"
  | "follow"
  | "unfollow";

export interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  status: "pending" | "processing" | "failed";
}

export interface MutationQueueStats {
  pendingCount: number;
  failedCount: number;
  oldestMutation: number | null;
}

class MutationQueueDB {
  private static instance: MutationQueueDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isProcessing = false;
  private onlineHandler: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): MutationQueueDB {
    if (!MutationQueueDB.instance) {
      MutationQueueDB.instance = new MutationQueueDB();
    }
    return MutationQueueDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open MutationQueueDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("MutationQueueDB initialized");
        this.setupOnlineListener();
        // Clean up expired mutations on startup
        this.removeExpired().then(
          () => resolve(),
          () => resolve(),
        );
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("type", "type", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("MutationQueueDB not initialized. Call init() first.");
    }
    return this.db;
  }

  private setupOnlineListener(): void {
    if (this.onlineHandler) return;

    this.onlineHandler = () => {
      debug.log("Network restored, processing mutation queue...");
      this.processQueue();
    };

    window.addEventListener("online", this.onlineHandler);
  }

  // Subscribe to queue changes
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }

  // Add a mutation to the queue
  async enqueue(
    type: MutationType,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const db = this.ensureDb();
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const mutation: QueuedMutation = {
      id,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(mutation);

      request.onsuccess = () => {
        debug.log(`Queued mutation: ${type}`, payload);
        this.notifyListeners();
        resolve(id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending mutations
  async getPendingMutations(): Promise<QueuedMutation[]> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("status");
      const request = index.getAll(IDBKeyRange.only("pending"));

      request.onsuccess = () => {
        const mutations = request.result as QueuedMutation[];
        // Sort by createdAt to process in order
        mutations.sort((a, b) => a.createdAt - b.createdAt);
        resolve(mutations);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get queue statistics
  async getStats(): Promise<MutationQueueStats> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("status");

      const pendingRequest = index.count(IDBKeyRange.only("pending"));
      const failedRequest = index.count(IDBKeyRange.only("failed"));
      const oldestRequest = store.index("createdAt").openCursor(null, "next");

      let pendingCount = 0;
      let failedCount = 0;
      let oldestMutation: number | null = null;

      pendingRequest.onsuccess = () => {
        pendingCount = pendingRequest.result;
      };

      failedRequest.onsuccess = () => {
        failedCount = failedRequest.result;
      };

      oldestRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          oldestMutation = cursor.value.createdAt;
        }
      };

      transaction.oncomplete = () => {
        resolve({ pendingCount, failedCount, oldestMutation });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Update mutation status
  async updateMutation(
    id: string,
    updates: Partial<QueuedMutation>,
  ): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const mutation = getRequest.result as QueuedMutation | undefined;
        if (!mutation) {
          resolve();
          return;
        }

        const updated = { ...mutation, ...updates };
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

  // Remove a mutation from the queue
  async remove(id: string): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all mutations
  async clearAll(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.notifyListeners();
        debug.log("Cleared all queued mutations");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Remove mutations older than MAX_AGE_MS
  async removeExpired(): Promise<void> {
    const db = this.ensureDb();
    const cutoff = Date.now() - MAX_AGE_MS;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("createdAt");
      const range = IDBKeyRange.upperBound(cutoff, true);
      const request = index.openCursor(range);
      let removed = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        if (removed > 0) {
          debug.log(`Removed ${removed} expired mutations (older than 24h)`);
          this.notifyListeners();
        }
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Process queue - called when online
  private processingResolver: (() => void) | null = null;

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      // Wait for current processing to finish
      return new Promise((resolve) => {
        const prevResolver = this.processingResolver;
        this.processingResolver = () => {
          prevResolver?.();
          resolve();
        };
      });
    }

    if (!navigator.onLine) {
      debug.log("Still offline, skipping queue processing");
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    try {
      // Discard expired mutations before processing
      await this.removeExpired();

      const mutations = await this.getPendingMutations();

      if (mutations.length === 0) {
        debug.log("No pending mutations to process");
        return;
      }

      debug.log(`Processing ${mutations.length} queued mutations...`);

      for (const mutation of mutations) {
        if (!navigator.onLine) {
          debug.log("Went offline during processing, stopping");
          break;
        }

        await this.processMutation(mutation);
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
      this.processingResolver?.();
      this.processingResolver = null;
    }
  }

  private async processMutation(mutation: QueuedMutation): Promise<void> {
    try {
      await this.updateMutation(mutation.id, { status: "processing" });

      // Execute the mutation
      await this.executeMutation(mutation);

      // Success - remove from queue
      await this.remove(mutation.id);
      debug.log(`Successfully processed mutation: ${mutation.type}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if it's a network error (should retry) or a real error (should fail)
      const isNetworkError = this.isNetworkError(error);

      if (isNetworkError && mutation.retryCount < 3) {
        // Network error - keep in queue for retry
        await this.updateMutation(mutation.id, {
          status: "pending",
          retryCount: mutation.retryCount + 1,
          lastError: errorMessage,
        });
        debug.log(
          `Network error processing mutation ${mutation.type}, will retry (${mutation.retryCount + 1}/3)`,
        );
      } else {
        // Non-network error or too many retries - mark as failed
        await this.updateMutation(mutation.id, {
          status: "failed",
          lastError: errorMessage,
        });
        debug.error(
          `Failed to process mutation ${mutation.type}:`,
          errorMessage,
        );
      }
    }
  }

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
      ];
      return networkIndicators.some((indicator) =>
        error.message.toLowerCase().includes(indicator.toLowerCase()),
      );
    }
    return false;
  }

  // Execute a mutation - this needs the agent to be set externally
  private mutationExecutor:
    | ((mutation: QueuedMutation) => Promise<void>)
    | null = null;

  setMutationExecutor(
    executor: (mutation: QueuedMutation) => Promise<void>,
  ): void {
    this.mutationExecutor = executor;
  }

  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    if (!this.mutationExecutor) {
      throw new Error("Mutation executor not set");
    }
    await this.mutationExecutor(mutation);
  }

  // Manual trigger for processing
  async triggerSync(): Promise<void> {
    if (!navigator.onLine) {
      debug.log("Cannot sync while offline");
      return;
    }
    await this.processQueue();
  }

  // Check if queue is currently processing
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  // Cleanup on destroy
  destroy(): void {
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    this.listeners.clear();
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }
}

export const mutationQueueDB = MutationQueueDB.getInstance();
