/**
 * Offline Post Queue Database
 *
 * IndexedDB-based queue for storing user posts, replies, and DMs
 * when offline. Auto-syncs when connectivity is restored.
 *
 * Features:
 * - Queue posts, replies, and DMs while offline
 * - Persist across app restarts
 * - Background sync when connectivity returns
 * - Conflict resolution with user notification
 * - Chunked attachment handling
 */

import { debug } from "@bsky/shared";
import { withIndexedDBRetry } from "../utils/storage-retry";

const DB_NAME = "BskyOfflinePostQueue";
const DB_VERSION = 1;
const STORE_NAME = "posts";

// Post types supported
export type PostType = "post" | "reply" | "dm" | "quote";

// Attachment status for chunked uploads
export type AttachmentStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface QueuedAttachment {
  id: string;
  type: "image" | "video";
  mimeType: string;
  // Store as base64 for IndexedDB (blobs can be problematic)
  data: string;
  altText?: string;
  status: AttachmentStatus;
  blobRef?: string; // Set after successful upload
  uploadProgress?: number;
  retryCount: number;
  lastError?: string;
}

export interface QueuedPost {
  id: string;
  type: PostType;
  text: string;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  status: "pending" | "processing" | "failed";

  // For replies
  replyTo?: {
    uri: string;
    cid: string;
    rootUri?: string;
    rootCid?: string;
  };

  // For quote posts
  quotedPost?: {
    uri: string;
    cid: string;
  };

  // For DMs
  dmConversationId?: string;

  // Attachments
  attachments?: QueuedAttachment[];

  // Facets (mentions, links, hashtags)
  facets?: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; [key: string]: unknown }>;
  }>;

  // Optional labels (content warnings)
  labels?: string[];

  // Languages
  langs?: string[];

  // Thread gate settings
  threadgate?: {
    allowMentioned?: boolean;
    allowFollowing?: boolean;
    allowLists?: string[];
  };
}

export interface PostQueueStats {
  pendingCount: number;
  failedCount: number;
  oldestPost: number | null;
  byType: {
    post: number;
    reply: number;
    dm: number;
    quote: number;
  };
}

class OfflinePostQueueDB {
  private static instance: OfflinePostQueueDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isProcessing = false;
  private onlineHandler: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): OfflinePostQueueDB {
    if (!OfflinePostQueueDB.instance) {
      OfflinePostQueueDB.instance = new OfflinePostQueueDB();
    }
    return OfflinePostQueueDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open OfflinePostQueueDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("OfflinePostQueueDB initialized");
        this.setupOnlineListener();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("type", "type", { unique: false });
          // Compound index for efficient type + status queries
          store.createIndex("type_status", ["type", "status"], {
            unique: false,
          });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("OfflinePostQueueDB not initialized. Call init() first.");
    }
    return this.db;
  }

  private setupOnlineListener(): void {
    if (this.onlineHandler) return;

    this.onlineHandler = () => {
      debug.log("Network restored, processing post queue...");
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

    // Also emit a custom event for components that listen directly
    window.dispatchEvent(
      new CustomEvent("offline-post-queue-update", {
        detail: { timestamp: Date.now() },
      }),
    );
  }

  // Add a post to the queue
  async enqueue(
    type: PostType,
    data: Omit<
      QueuedPost,
      "id" | "type" | "createdAt" | "retryCount" | "status"
    >,
  ): Promise<string> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const post: QueuedPost = {
        ...data,
        id,
        type,
        createdAt: Date.now(),
        retryCount: 0,
        status: "pending",
      };

      return new Promise<string>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(post);

        request.onsuccess = () => {
          debug.log(`Queued offline ${type}:`, post.text.slice(0, 50));
          this.notifyListeners();

          // Try to register background sync
          this.registerBackgroundSync();

          resolve(id);
        };

        request.onerror = () => reject(request.error);
      });
    }, "enqueue");
  }

  // Get all pending posts
  async getPendingPosts(): Promise<QueuedPost[]> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("status");
      const request = index.getAll(IDBKeyRange.only("pending"));

      request.onsuccess = () => {
        const posts = request.result as QueuedPost[];
        // Sort by createdAt to process in order
        posts.sort((a, b) => a.createdAt - b.createdAt);
        resolve(posts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get all posts (including failed)
  async getAllPosts(): Promise<QueuedPost[]> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const posts = request.result as QueuedPost[];
        posts.sort((a, b) => a.createdAt - b.createdAt);
        resolve(posts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get queue statistics
  async getStats(): Promise<PostQueueStats> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const statusIndex = store.index("status");
      const typeIndex = store.index("type");

      const pendingRequest = statusIndex.count(IDBKeyRange.only("pending"));
      const failedRequest = statusIndex.count(IDBKeyRange.only("failed"));
      const oldestRequest = store.index("createdAt").openCursor(null, "next");

      const postCountRequest = typeIndex.count(IDBKeyRange.only("post"));
      const replyCountRequest = typeIndex.count(IDBKeyRange.only("reply"));
      const dmCountRequest = typeIndex.count(IDBKeyRange.only("dm"));
      const quoteCountRequest = typeIndex.count(IDBKeyRange.only("quote"));

      let pendingCount = 0;
      let failedCount = 0;
      let oldestPost: number | null = null;
      const byType = { post: 0, reply: 0, dm: 0, quote: 0 };

      pendingRequest.onsuccess = () => {
        pendingCount = pendingRequest.result;
      };

      failedRequest.onsuccess = () => {
        failedCount = failedRequest.result;
      };

      oldestRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          oldestPost = cursor.value.createdAt;
        }
      };

      postCountRequest.onsuccess = () => {
        byType.post = postCountRequest.result;
      };

      replyCountRequest.onsuccess = () => {
        byType.reply = replyCountRequest.result;
      };

      dmCountRequest.onsuccess = () => {
        byType.dm = dmCountRequest.result;
      };

      quoteCountRequest.onsuccess = () => {
        byType.quote = quoteCountRequest.result;
      };

      transaction.oncomplete = () => {
        resolve({ pendingCount, failedCount, oldestPost, byType });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Update a post
  async updatePost(id: string, updates: Partial<QueuedPost>): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const post = getRequest.result as QueuedPost | undefined;
          if (!post) {
            resolve();
            return;
          }

          const updated = { ...post, ...updates };
          const putRequest = store.put(updated);

          putRequest.onsuccess = () => {
            this.notifyListeners();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    }, "updatePost");
  }

  // Remove a post from the queue
  async remove(id: string): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          this.notifyListeners();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }, "remove");
  }

  // Clear all posts
  async clearAll(): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          this.notifyListeners();
          debug.log("Cleared all queued posts");
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }, "clearAll");
  }

  // Retry a failed post
  async retryPost(id: string): Promise<void> {
    await this.updatePost(id, {
      status: "pending",
      lastError: undefined,
    });

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  // Discard a failed post
  async discardPost(id: string): Promise<void> {
    await this.remove(id);
  }

  // Register background sync
  private async registerBackgroundSync(): Promise<void> {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Check if sync is available on the registration
        interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
          sync?: {
            register(tag: string): Promise<void>;
          };
        }
        const registrationWithSync =
          registration as ServiceWorkerRegistrationWithSync;
        if (registrationWithSync.sync) {
          await registrationWithSync.sync.register("post-sync");
          debug.log("Registered background sync for post-sync");
        }
      } catch (error) {
        debug.warn("Failed to register background sync:", error);
      }
    }
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
      debug.log("Still offline, skipping post queue processing");
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    try {
      const posts = await this.getPendingPosts();

      if (posts.length === 0) {
        debug.log("No pending posts to process");
        return;
      }

      debug.log(`Processing ${posts.length} queued posts...`);

      for (const post of posts) {
        if (!navigator.onLine) {
          debug.log("Went offline during processing, stopping");
          break;
        }

        await this.processPost(post);
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
      this.processingResolver?.();
      this.processingResolver = null;
    }
  }

  private async processPost(post: QueuedPost): Promise<void> {
    try {
      await this.updatePost(post.id, { status: "processing" });

      // Execute the post
      await this.executePost(post);

      // Success - remove from queue
      await this.remove(post.id);
      debug.log(`Successfully posted offline ${post.type}`);

      // Notify user of success
      this.notifyPostSuccess(post);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if it's a network error (should retry) or a real error (should fail)
      const isNetworkError = this.isNetworkError(error);
      const maxRetries = 3;

      if (isNetworkError && post.retryCount < maxRetries) {
        // Network error - keep in queue for retry
        await this.updatePost(post.id, {
          status: "pending",
          retryCount: post.retryCount + 1,
          lastError: errorMessage,
        });
        debug.log(
          `Network error posting ${post.type}, will retry (${post.retryCount + 1}/${maxRetries})`,
        );
      } else {
        // Non-network error or too many retries - mark as failed
        await this.updatePost(post.id, {
          status: "failed",
          lastError: errorMessage,
        });
        debug.error(`Failed to post ${post.type}:`, errorMessage);

        // Notify user of failure
        this.notifyPostFailure(post, errorMessage);
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
        "ERR_INTERNET_DISCONNECTED",
      ];
      return networkIndicators.some((indicator) =>
        error.message.toLowerCase().includes(indicator.toLowerCase()),
      );
    }
    return false;
  }

  // Execute a post - this needs the agent to be set externally
  private postExecutor: ((post: QueuedPost) => Promise<void>) | null = null;

  setPostExecutor(executor: (post: QueuedPost) => Promise<void>): void {
    this.postExecutor = executor;
  }

  private async executePost(post: QueuedPost): Promise<void> {
    if (!this.postExecutor) {
      throw new Error("Post executor not set");
    }
    await this.postExecutor(post);
  }

  // Notify user of post success
  private notifyPostSuccess(post: QueuedPost): void {
    window.dispatchEvent(
      new CustomEvent("offline-post-success", {
        detail: {
          id: post.id,
          type: post.type,
          text: post.text.slice(0, 50),
        },
      }),
    );
  }

  // Notify user of post failure
  private notifyPostFailure(post: QueuedPost, error: string): void {
    window.dispatchEvent(
      new CustomEvent("offline-post-failure", {
        detail: {
          id: post.id,
          type: post.type,
          text: post.text.slice(0, 50),
          error,
        },
      }),
    );
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

export const offlinePostQueueDB = OfflinePostQueueDB.getInstance();
