/**
 * Scheduled Post Database
 *
 * IndexedDB-based persistence layer for scheduled posts.
 * Provides local caching with sync to server for redundancy.
 */

import { debug } from "@bsky/shared";
import {
  CreateScheduledPostInput,
  ScheduledPost,
  ScheduledPostFilter,
  ScheduledPostQueueStats,
  ScheduledPostStatus,
  UpdateScheduledPostInput,
  generateScheduledPostId,
} from "./types";

const DB_NAME = "BskyScheduledPosts";
const DB_VERSION = 1;
const STORE_NAME = "scheduledPosts";

/**
 * IndexedDB database for scheduled posts
 * Provides offline persistence and sync capabilities
 */
class ScheduledPostDB {
  private static instance: ScheduledPostDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners: Set<(posts: ScheduledPost[]) => void> = new Set();
  private currentUserDid: string | null = null;

  private constructor() {}

  static getInstance(): ScheduledPostDB {
    if (!ScheduledPostDB.instance) {
      ScheduledPostDB.instance = new ScheduledPostDB();
    }
    return ScheduledPostDB.instance;
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open ScheduledPostDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("ScheduledPostDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

          // Indexes for efficient queries
          store.createIndex("userDid", "userDid", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("scheduledFor", "scheduledFor", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });

          // Compound indexes for common query patterns
          store.createIndex("userDid_status", ["userDid", "status"], {
            unique: false,
          });
          store.createIndex(
            "userDid_scheduledFor",
            ["userDid", "scheduledFor"],
            {
              unique: false,
            },
          );
          store.createIndex("status_scheduledFor", ["status", "scheduledFor"], {
            unique: false,
          });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Set the current user DID for scoped operations
   */
  setCurrentUser(did: string): void {
    this.currentUserDid = did;
  }

  /**
   * Get the current user DID
   */
  getCurrentUser(): string | null {
    return this.currentUserDid;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("ScheduledPostDB not initialized. Call init() first.");
    }
    return this.db;
  }

  private ensureUser(): string {
    if (!this.currentUserDid) {
      throw new Error("No user set. Call setCurrentUser() first.");
    }
    return this.currentUserDid;
  }

  /**
   * Subscribe to changes in scheduled posts
   */
  subscribe(callback: (posts: ScheduledPost[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async notifyListeners(): Promise<void> {
    const posts = await this.getAll();
    this.listeners.forEach((cb) => cb(posts));
  }

  /**
   * Create a new scheduled post
   */
  async create(input: CreateScheduledPostInput): Promise<ScheduledPost> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    const now = new Date().toISOString();
    const post: ScheduledPost = {
      id: generateScheduledPostId(),
      userDid,
      scheduledFor: input.scheduledFor,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      text: input.text,
      media: input.media,
      threadPosts: input.threadPosts,
      threadConfig: input.threadConfig,
      threadgate: input.threadgate,
      replyTo: input.replyTo,
      quotedPost: input.quotedPost,
      draftId: input.draftId,
      retryCount: 0,
      maxRetries: 3,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(post);

      request.onsuccess = () => {
        debug.log(`Created scheduled post: ${post.id}`);
        this.notifyListeners();
        resolve(post);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a scheduled post by ID
   */
  async get(id: string): Promise<ScheduledPost | null> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const post = request.result as ScheduledPost | undefined;
        // Only return if belongs to current user
        if (post && post.userDid === userDid) {
          resolve(post);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all scheduled posts for the current user
   */
  async getAll(filter?: ScheduledPostFilter): Promise<ScheduledPost[]> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("userDid");
      const request = index.getAll(IDBKeyRange.only(userDid));

      request.onsuccess = () => {
        let posts = request.result as ScheduledPost[];

        // Apply filters
        if (filter) {
          if (filter.status) {
            const statuses = Array.isArray(filter.status)
              ? filter.status
              : [filter.status];
            posts = posts.filter((p) =>
              statuses.includes(p.status as ScheduledPostStatus),
            );
          }

          if (filter.scheduledBefore) {
            posts = posts.filter(
              (p) => p.scheduledFor < filter.scheduledBefore!,
            );
          }

          if (filter.scheduledAfter) {
            posts = posts.filter(
              (p) => p.scheduledFor > filter.scheduledAfter!,
            );
          }
        }

        // Sort by scheduled time
        posts.sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        );

        // Apply pagination
        if (filter?.offset) {
          posts = posts.slice(filter.offset);
        }
        if (filter?.limit) {
          posts = posts.slice(0, filter.limit);
        }

        resolve(posts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending posts that are ready to be published
   */
  async getPendingDue(serverTimeOffset = 0): Promise<ScheduledPost[]> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    // Adjust current time by server offset
    const adjustedNow = new Date(Date.now() + serverTimeOffset).toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("userDid_status");
      const request = index.getAll(IDBKeyRange.only([userDid, "pending"]));

      request.onsuccess = () => {
        const posts = (request.result as ScheduledPost[]).filter(
          (p) => p.scheduledFor <= adjustedNow,
        );

        // Sort by scheduled time (earliest first)
        posts.sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        );

        resolve(posts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update a scheduled post
   */
  async update(
    id: string,
    updates: UpdateScheduledPostInput,
  ): Promise<ScheduledPost | null> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const post = getRequest.result as ScheduledPost | undefined;

        if (!post || post.userDid !== userDid) {
          resolve(null);
          return;
        }

        const updatedPost: ScheduledPost = {
          ...post,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedPost);

        putRequest.onsuccess = () => {
          debug.log(`Updated scheduled post: ${id}`);
          this.notifyListeners();
          resolve(updatedPost);
        };

        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update post status with optional error info
   */
  async updateStatus(
    id: string,
    status: ScheduledPostStatus,
    options?: {
      lastError?: string;
      publishedUris?: string[];
      publishedAt?: string;
      incrementRetry?: boolean;
    },
  ): Promise<ScheduledPost | null> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const post = getRequest.result as ScheduledPost | undefined;

        if (!post || post.userDid !== userDid) {
          resolve(null);
          return;
        }

        const updatedPost: ScheduledPost = {
          ...post,
          status,
          updatedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        };

        if (options?.lastError !== undefined) {
          updatedPost.lastError = options.lastError;
        }

        if (options?.publishedUris !== undefined) {
          updatedPost.publishedUris = options.publishedUris;
        }

        if (options?.publishedAt !== undefined) {
          updatedPost.publishedAt = options.publishedAt;
        }

        if (options?.incrementRetry) {
          updatedPost.retryCount = (post.retryCount || 0) + 1;
        }

        const putRequest = store.put(updatedPost);

        putRequest.onsuccess = () => {
          debug.log(`Updated scheduled post status: ${id} -> ${status}`);
          this.notifyListeners();
          resolve(updatedPost);
        };

        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a scheduled post
   */
  async delete(id: string): Promise<boolean> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    // First verify ownership
    const post = await this.get(id);
    if (!post || post.userDid !== userDid) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        debug.log(`Deleted scheduled post: ${id}`);
        this.notifyListeners();
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cancel a scheduled post (soft delete)
   */
  async cancel(id: string): Promise<ScheduledPost | null> {
    return this.updateStatus(id, "cancelled");
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<ScheduledPostQueueStats> {
    const posts = await this.getAll();

    const stats: ScheduledPostQueueStats = {
      total: posts.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    let nextScheduledAt: string | undefined;

    for (const post of posts) {
      switch (post.status) {
        case "pending":
          stats.pending++;
          if (!nextScheduledAt || post.scheduledFor < nextScheduledAt) {
            nextScheduledAt = post.scheduledFor;
          }
          break;
        case "processing":
          stats.processing++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "failed":
          stats.failed++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
      }
    }

    stats.nextScheduledAt = nextScheduledAt;

    return stats;
  }

  /**
   * Import posts from server sync
   */
  async importFromServer(posts: ScheduledPost[]): Promise<void> {
    const db = this.ensureDb();
    const userDid = this.ensureUser();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      let errors = 0;

      for (const post of posts) {
        // Only import posts belonging to current user
        if (post.userDid !== userDid) {
          completed++;
          continue;
        }

        const request = store.put(post);

        request.onsuccess = () => {
          completed++;
          if (completed + errors === posts.length) {
            this.notifyListeners();
            resolve();
          }
        };

        request.onerror = () => {
          errors++;
          debug.error(`Failed to import post ${post.id}:`, request.error);
          if (completed + errors === posts.length) {
            this.notifyListeners();
            resolve();
          }
        };
      }

      if (posts.length === 0) {
        resolve();
      }
    });
  }

  /**
   * Export all posts for server sync
   */
  async exportForServer(): Promise<ScheduledPost[]> {
    return this.getAll();
  }

  /**
   * Clear all data (for testing or account switch)
   */
  async clearAll(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        debug.log("Cleared all scheduled posts");
        this.notifyListeners();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear only current user's data
   */
  async clearCurrentUserData(): Promise<void> {
    const posts = await this.getAll();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;

      for (const post of posts) {
        const request = store.delete(post.id);

        request.onsuccess = () => {
          completed++;
          if (completed === posts.length) {
            this.notifyListeners();
            resolve();
          }
        };

        request.onerror = () => {
          completed++;
          if (completed === posts.length) {
            this.notifyListeners();
            resolve();
          }
        };
      }

      if (posts.length === 0) {
        resolve();
      }
    });
  }

  /**
   * Close the database connection
   */
  destroy(): void {
    this.listeners.clear();
    this.db?.close();
    this.db = null;
    this.initPromise = null;
    this.currentUserDid = null;
  }
}

export const scheduledPostDB = ScheduledPostDB.getInstance();
