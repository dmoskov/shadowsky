import { debug } from "@bsky/shared";

export interface AnalyticsSnapshot {
  id?: number;
  timestamp: Date;
  userId: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  likes?: number;
  reposts?: number;
  replies?: number;
}

export interface PostMetrics {
  id?: number;
  postUri: string;
  userId: string;
  timestamp: Date;
  likes: number;
  reposts: number;
  replies: number;
  engagement: number;
}

const DB_NAME = "AnalyticsTrackingDB";
const DB_VERSION = 1;
const SNAPSHOTS_STORE = "snapshots";
const POST_METRICS_STORE = "postMetrics";

export class AnalyticsTrackingDB {
  private db: IDBDatabase | null = null;
  private static instance: AnalyticsTrackingDB | null = null;

  static getInstance(): AnalyticsTrackingDB {
    if (!AnalyticsTrackingDB.instance) {
      AnalyticsTrackingDB.instance = new AnalyticsTrackingDB();
    }
    return AnalyticsTrackingDB.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open analytics database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("Analytics tracking database initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          const snapshotStore = db.createObjectStore(SNAPSHOTS_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          snapshotStore.createIndex("userId", "userId", { unique: false });
          snapshotStore.createIndex("timestamp", "timestamp", {
            unique: false,
          });
          snapshotStore.createIndex("userIdTimestamp", ["userId", "timestamp"], {
            unique: false,
          });
          debug.log("Created snapshots store");
        }

        if (!db.objectStoreNames.contains(POST_METRICS_STORE)) {
          const metricsStore = db.createObjectStore(POST_METRICS_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          metricsStore.createIndex("postUri", "postUri", { unique: false });
          metricsStore.createIndex("userId", "userId", { unique: false });
          metricsStore.createIndex("timestamp", "timestamp", { unique: false });
          debug.log("Created post metrics store");
        }
      };
    });
  }

  async saveSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction([SNAPSHOTS_STORE], "readwrite");
    const store = tx.objectStore(SNAPSHOTS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.add(snapshot);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSnapshots(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsSnapshot[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction([SNAPSHOTS_STORE], "readonly");
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const index = store.index("userIdTimestamp");

    const range = IDBKeyRange.bound([userId, startDate], [userId, endDate]);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestSnapshot(userId: string): Promise<AnalyticsSnapshot | null> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction([SNAPSHOTS_STORE], "readonly");
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const index = store.index("userId");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(
        IDBKeyRange.only(userId),
        "prev",
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve(cursor.value as AnalyticsSnapshot);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePostMetrics(metrics: PostMetrics): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction([POST_METRICS_STORE], "readwrite");
    const store = tx.objectStore(POST_METRICS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.add(metrics);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPostMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PostMetrics[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const tx = this.db.transaction([POST_METRICS_STORE], "readonly");
    const store = tx.objectStore(POST_METRICS_STORE);
    const index = store.index("timestamp");

    const range = IDBKeyRange.bound(startDate, endDate);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => {
        const allMetrics = request.result || [];
        const userMetrics = allMetrics.filter((m) => m.userId === userId);
        resolve(userMetrics);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cleanOldSnapshots(userId: string, daysToKeep: number = 365): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const tx = this.db.transaction([SNAPSHOTS_STORE], "readwrite");
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const index = store.index("userIdTimestamp");

    const range = IDBKeyRange.bound(
      [userId, new Date(0)],
      [userId, cutoffDate],
    );

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async hasHistoricalData(userId: string): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    const tx = this.db.transaction([SNAPSHOTS_STORE], "readonly");
    const store = tx.objectStore(SNAPSHOTS_STORE);
    const index = store.index("userId");

    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(userId));
      request.onsuccess = () => resolve(request.result > 1);
      request.onerror = () => reject(request.error);
    });
  }
}

export const analyticsTrackingDB = AnalyticsTrackingDB.getInstance();
