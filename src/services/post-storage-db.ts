import { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";

type Post = AppBskyFeedDefs.PostView;

interface PostMetadata {
  id: string;
  lastUpdate: number;
  totalCount: number;
}

const DB_NAME = "BskyPostCache";
const DB_VERSION = 1;
const POST_STORE = "posts";
const METADATA_STORE = "metadata";

// localStorage keys for migration
const POST_CACHE_KEY = "bsky_notification_posts_";
const POST_CACHE_VERSION = "v1";

export class PostStorageDB {
  private static instance: PostStorageDB;
  private db: IDBDatabase | null = null;

  private constructor() {}

  static getInstance(): PostStorageDB {
    if (!PostStorageDB.instance) {
      PostStorageDB.instance = new PostStorageDB();
    }
    return PostStorageDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open PostStorageDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("PostStorageDB initialized successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create posts store
        if (!db.objectStoreNames.contains(POST_STORE)) {
          const postStore = db.createObjectStore(POST_STORE, {
            keyPath: "uri",
          });
          // Create indexes for efficient queries
          postStore.createIndex("indexedAt", "indexedAt", { unique: false });
          postStore.createIndex("authorDid", "author.did", { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: "id" });
        }
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("PostStorageDB not initialized. Call init() first.");
    }
    return this.db;
  }

  // Save multiple posts
  async savePosts(posts: Post[]): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readwrite");
    const store = transaction.objectStore(POST_STORE);

    for (const post of posts) {
      // Store post with current timestamp for cache management
      const postWithTimestamp = {
        ...post,
        _cachedAt: Date.now(),
      };
      store.put(postWithTimestamp);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Get a single post by URI
  async getPost(uri: string): Promise<Post | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(uri);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Remove internal fields before returning
          delete result._cachedAt;
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get multiple posts by URIs
  async getPosts(uris: string[]): Promise<Post[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);

    const posts: Post[] = [];

    for (const uri of uris) {
      const request = store.get(uri);
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            delete result._cachedAt;
            posts.push(result);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }

    return posts;
  }

  // Get all posts with pagination
  async getAllPosts(limit = 1000, offset = 0): Promise<Post[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);
    const index = store.index("indexedAt");

    const posts: Post[] = [];
    let count = 0;
    let skipped = 0;

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev"); // Most recent first

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && count < limit) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }

          const post = cursor.value;
          delete post._cachedAt;
          posts.push(post);
          count++;
          cursor.continue();
        } else {
          resolve(posts);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get total count of posts
  async getCount(): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get oldest post
  async getOldestPost(): Promise<Post | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);
    const index = store.index("indexedAt");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "next"); // Oldest first

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const post = cursor.value;
          delete post._cachedAt;
          resolve(post);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get newest post
  async getNewestPost(): Promise<Post | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);
    const index = store.index("indexedAt");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev"); // Newest first

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const post = cursor.value;
          delete post._cachedAt;
          resolve(post);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete posts older than a specific date
  async deletePostsOlderThan(date: Date): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readwrite");
    const store = transaction.objectStore(POST_STORE);

    let deletedCount = 0;
    const cutoffTime = date.getTime();

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const post = cursor.value;
          const cachedAt = post._cachedAt || new Date(post.indexedAt).getTime();

          if (cachedAt < cutoffTime) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all posts
  async clearAll(): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [POST_STORE, METADATA_STORE],
      "readwrite",
    );

    transaction.objectStore(POST_STORE).clear();
    transaction.objectStore(METADATA_STORE).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Metadata operations
  async saveMetadata(metadata: PostMetadata): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([METADATA_STORE], "readwrite");
    const store = transaction.objectStore(METADATA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(): Promise<PostMetadata | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([METADATA_STORE], "readonly");
    const store = transaction.objectStore(METADATA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get("main");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Migrate from localStorage to IndexedDB
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const cacheKey = `${POST_CACHE_KEY}${POST_CACHE_VERSION}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) {
        return false;
      }

      const parsed = JSON.parse(cachedData);
      if (parsed.version !== POST_CACHE_VERSION || !parsed.posts) {
        return false;
      }

      // Convert object to array of posts
      const posts = Object.values(parsed.posts) as Post[];

      if (posts.length === 0) {
        return false;
      }

      debug.log(
        `Migrating ${posts.length} posts from localStorage to IndexedDB...`,
      );

      // Save posts to IndexedDB
      await this.savePosts(posts);

      // Save metadata
      await this.saveMetadata({
        id: "main",
        lastUpdate: parsed.timestamp || Date.now(),
        totalCount: posts.length,
      });

      // Clear localStorage after successful migration
      localStorage.removeItem(cacheKey);

      debug.log("Post migration completed successfully");
      return true;
    } catch (error) {
      debug.error("Failed to migrate posts from localStorage:", error);
      return false;
    }
  }
}
