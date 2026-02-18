import { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { createQueryTimer, isMonitoring } from "../utils/indexeddb-performance";

type Post = AppBskyFeedDefs.PostView;

interface PostMetadata {
  id: string;
  lastUpdate: number;
  totalCount: number;
}

const DB_NAME = "BskyPostCache";
const DB_VERSION = 2; // Bumped for compound indexes
const POST_STORE = "posts";
const METADATA_STORE = "metadata";

// Index names for compound indexes
const INDEX_AUTHOR_INDEXED_AT = "authorDid_indexedAt";
const INDEX_CACHED_AT = "cachedAt";

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
        const oldVersion = event.oldVersion;

        // Create posts store (version 1)
        if (!db.objectStoreNames.contains(POST_STORE)) {
          const postStore = db.createObjectStore(POST_STORE, {
            keyPath: "uri",
          });
          // Create indexes for efficient queries
          postStore.createIndex("indexedAt", "indexedAt", { unique: false });
          postStore.createIndex("authorDid", "author.did", { unique: false });
        }

        // Create metadata store (version 1)
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: "id" });
        }

        // Version 2: Add compound indexes for O(log n) query performance
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const postStore = transaction.objectStore(POST_STORE);

            // Compound index: (authorDid, indexedAt) - for author queries sorted by time
            // Enables efficient "get all posts by author X sorted by date" queries
            if (!postStore.indexNames.contains(INDEX_AUTHOR_INDEXED_AT)) {
              postStore.createIndex(
                INDEX_AUTHOR_INDEXED_AT,
                ["author.did", "indexedAt"],
                { unique: false },
              );
            }

            // Index: cachedAt - for cache cleanup queries
            // Enables efficient "delete posts cached before X" queries
            if (!postStore.indexNames.contains(INDEX_CACHED_AT)) {
              postStore.createIndex(INDEX_CACHED_AT, "_cachedAt", {
                unique: false,
              });
            }
          }
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
    const timer = isMonitoring() ? createQueryTimer("getAllPosts") : null;

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
          timer?.end(posts.length, "indexedAt", false);
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

  // Delete posts older than a specific date (uses cachedAt index for O(log n) performance)
  async deletePostsOlderThan(date: Date): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readwrite");
    const store = transaction.objectStore(POST_STORE);

    let deletedCount = 0;
    const cutoffTime = date.getTime();

    return new Promise((resolve, reject) => {
      // Use cachedAt index if available for O(log n) performance
      const hasIndex = store.indexNames.contains(INDEX_CACHED_AT);
      const cursorSource = hasIndex
        ? store
            .index(INDEX_CACHED_AT)
            .openCursor(IDBKeyRange.upperBound(cutoffTime))
        : store.openCursor();

      cursorSource.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          if (hasIndex) {
            // Index already filtered, delete all cursor results
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            // Fallback: manual filtering
            const post = cursor.value;
            const cachedAt = post._cachedAt || Date.now();

            if (cachedAt < cutoffTime) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          }
        } else {
          resolve(deletedCount);
        }
      };

      cursorSource.onerror = () => reject(cursorSource.error);
    });
  }

  // Get posts by author, sorted by indexedAt (uses compound index for O(log n) performance)
  async getPostsByAuthor(
    authorDid: string,
    limit = 100,
    direction: "prev" | "next" = "prev",
  ): Promise<Post[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);

    const posts: Post[] = [];
    const timer = isMonitoring() ? createQueryTimer("getPostsByAuthor") : null;

    return new Promise((resolve, reject) => {
      // Use compound index if available for O(log n) performance
      const hasCompoundIndex = store.indexNames.contains(
        INDEX_AUTHOR_INDEXED_AT,
      );

      if (hasCompoundIndex) {
        // Use compound index: range query on authorDid with natural sorting by indexedAt
        const index = store.index(INDEX_AUTHOR_INDEXED_AT);
        // Create a key range that matches all entries for this author
        const range = IDBKeyRange.bound([authorDid, ""], [authorDid, "\uffff"]);

        const request = index.openCursor(range, direction);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && posts.length < limit) {
            const post = cursor.value;
            delete post._cachedAt;
            posts.push(post);
            cursor.continue();
          } else {
            timer?.end(posts.length, INDEX_AUTHOR_INDEXED_AT, true);
            resolve(posts);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: use single authorDid index (O(n) in worst case)
        const index = store.index("authorDid");
        const request = index.openCursor(IDBKeyRange.only(authorDid));

        const allPosts: Post[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            const post = cursor.value;
            delete post._cachedAt;
            allPosts.push(post);
            cursor.continue();
          } else {
            // Sort manually and return
            allPosts.sort((a, b) => {
              const dateA = new Date(a.indexedAt).getTime();
              const dateB = new Date(b.indexedAt).getTime();
              return direction === "prev" ? dateB - dateA : dateA - dateB;
            });
            const result = allPosts.slice(0, limit);
            timer?.end(result.length, "authorDid", false);
            resolve(result);
          }
        };

        request.onerror = () => reject(request.error);
      }
    });
  }

  // Get posts by author within a date range (uses compound index for O(log n) performance)
  async getPostsByAuthorInRange(
    authorDid: string,
    startDate: Date,
    endDate: Date,
    limit = 100,
  ): Promise<Post[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([POST_STORE], "readonly");
    const store = transaction.objectStore(POST_STORE);

    const posts: Post[] = [];
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    return new Promise((resolve, reject) => {
      const hasCompoundIndex = store.indexNames.contains(
        INDEX_AUTHOR_INDEXED_AT,
      );

      if (hasCompoundIndex) {
        // Use compound index with precise date range
        const index = store.index(INDEX_AUTHOR_INDEXED_AT);
        const range = IDBKeyRange.bound(
          [authorDid, startIso],
          [authorDid, endIso],
        );

        const request = index.openCursor(range, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && posts.length < limit) {
            const post = cursor.value;
            delete post._cachedAt;
            posts.push(post);
            cursor.continue();
          } else {
            resolve(posts);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: get all posts by author and filter by date
        this.getPostsByAuthor(authorDid, Infinity)
          .then((allPosts) => {
            const filtered = allPosts.filter((post) => {
              const postDate = post.indexedAt;
              return postDate >= startIso && postDate <= endIso;
            });
            resolve(filtered.slice(0, limit));
          })
          .catch(reject);
      }
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
