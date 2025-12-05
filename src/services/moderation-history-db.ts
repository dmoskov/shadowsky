/**
 * Moderation History Database
 *
 * IndexedDB-based storage for tracking moderation actions (blocks, mutes, reports)
 * with timestamps for user history and auditing.
 */

import { debug } from "@bsky/shared";
import { withIndexedDBRetry } from "../utils/storage-retry";

const DB_NAME = "BskyModerationHistory";
const DB_VERSION = 1;

// Store names
const STORES = {
  BLOCKS: "blocks",
  MUTES: "mutes",
  REPORTS: "reports",
} as const;

// Storage limits
const LIMITS = {
  MAX_BLOCKS: 1000,
  MAX_MUTES: 1000,
  MAX_REPORTS: 500,
  MAX_AGE_DAYS: 365, // Keep history for 1 year
} as const;

export type ModerationActionType = "block" | "mute" | "report";

export type ReportReasonType =
  | "spam"
  | "violation"
  | "misleading"
  | "sexual"
  | "rude"
  | "other";

export interface BlockHistoryEntry {
  id: string; // block URI
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  subjectAvatar?: string;
  createdAt: number;
  unblockedAt?: number;
  isActive: boolean;
}

export interface MuteHistoryEntry {
  id: string; // generated ID (subjectDid + timestamp)
  subjectDid: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  subjectAvatar?: string;
  createdAt: number;
  unmutedAt?: number;
  isActive: boolean;
}

export interface ReportHistoryEntry {
  id: string; // generated ID
  subjectUri: string;
  subjectType: "post" | "account" | "feed" | "list";
  subjectDid?: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  subjectText?: string; // For posts, a snippet of the content
  reason: ReportReasonType;
  reasonText?: string;
  createdAt: number;
  status: "pending" | "resolved" | "unknown";
}

export interface ModerationHistoryStats {
  totalBlocks: number;
  activeBlocks: number;
  totalMutes: number;
  activeMutes: number;
  totalReports: number;
  pendingReports: number;
}

export interface ModerationHistoryFilter {
  type?: ModerationActionType;
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
  activeOnly?: boolean;
}

export class ModerationHistoryDB {
  private static instance: ModerationHistoryDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ModerationHistoryDB {
    if (!ModerationHistoryDB.instance) {
      ModerationHistoryDB.instance = new ModerationHistoryDB();
    }
    return ModerationHistoryDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open ModerationHistoryDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("ModerationHistoryDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Blocks store
        if (!db.objectStoreNames.contains(STORES.BLOCKS)) {
          const blockStore = db.createObjectStore(STORES.BLOCKS, {
            keyPath: "id",
          });
          blockStore.createIndex("subjectDid", "subjectDid", { unique: false });
          blockStore.createIndex("createdAt", "createdAt", { unique: false });
          blockStore.createIndex("isActive", "isActive", { unique: false });
          blockStore.createIndex("subjectHandle", "subjectHandle", {
            unique: false,
          });
        }

        // Mutes store
        if (!db.objectStoreNames.contains(STORES.MUTES)) {
          const muteStore = db.createObjectStore(STORES.MUTES, {
            keyPath: "id",
          });
          muteStore.createIndex("subjectDid", "subjectDid", { unique: false });
          muteStore.createIndex("createdAt", "createdAt", { unique: false });
          muteStore.createIndex("isActive", "isActive", { unique: false });
          muteStore.createIndex("subjectHandle", "subjectHandle", {
            unique: false,
          });
        }

        // Reports store
        if (!db.objectStoreNames.contains(STORES.REPORTS)) {
          const reportStore = db.createObjectStore(STORES.REPORTS, {
            keyPath: "id",
          });
          reportStore.createIndex("subjectUri", "subjectUri", {
            unique: false,
          });
          reportStore.createIndex("subjectType", "subjectType", {
            unique: false,
          });
          reportStore.createIndex("createdAt", "createdAt", { unique: false });
          reportStore.createIndex("status", "status", { unique: false });
          reportStore.createIndex("reason", "reason", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error(
        "ModerationHistoryDB not initialized. Call init() first.",
      );
    }
    return this.db;
  }

  // ==================== Block Operations ====================

  async recordBlock(entry: Omit<BlockHistoryEntry, "isActive">): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.BLOCKS], "readwrite");
      const store = transaction.objectStore(STORES.BLOCKS);

      const blockEntry: BlockHistoryEntry = {
        ...entry,
        isActive: true,
      };

      store.put(blockEntry);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          debug.log(
            `Recorded block for: ${entry.subjectHandle || entry.subjectDid}`,
          );
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "recordBlock");
  }

  async recordUnblock(blockUri: string): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.BLOCKS], "readwrite");
      const store = transaction.objectStore(STORES.BLOCKS);

      return new Promise<void>((resolve, reject) => {
        const request = store.get(blockUri);

        request.onsuccess = () => {
          const entry = request.result as BlockHistoryEntry | undefined;
          if (entry) {
            entry.isActive = false;
            entry.unblockedAt = Date.now();
            store.put(entry);
          }
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }, "recordUnblock");
  }

  async getBlocks(
    options: { activeOnly?: boolean; limit?: number } = {},
  ): Promise<BlockHistoryEntry[]> {
    const { activeOnly = false, limit = 100 } = options;
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.BLOCKS], "readonly");
    const store = transaction.objectStore(STORES.BLOCKS);
    const index = store.index("createdAt");

    const results: BlockHistoryEntry[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && results.length < limit) {
          const entry = cursor.value as BlockHistoryEntry;
          if (!activeOnly || entry.isActive) {
            results.push(entry);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getBlockByDid(did: string): Promise<BlockHistoryEntry | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.BLOCKS], "readonly");
    const store = transaction.objectStore(STORES.BLOCKS);
    const index = store.index("subjectDid");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(did), "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value as BlockHistoryEntry);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Mute Operations ====================

  async recordMute(
    entry: Omit<MuteHistoryEntry, "id" | "isActive">,
  ): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.MUTES], "readwrite");
      const store = transaction.objectStore(STORES.MUTES);

      const muteEntry: MuteHistoryEntry = {
        ...entry,
        id: `${entry.subjectDid}_${entry.createdAt}`,
        isActive: true,
      };

      // Mark any previous active mutes for this user as inactive
      const index = store.index("subjectDid");
      const cursorRequest = index.openCursor(
        IDBKeyRange.only(entry.subjectDid),
      );

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const existing = cursor.value as MuteHistoryEntry;
          if (existing.isActive) {
            existing.isActive = false;
            existing.unmutedAt = entry.createdAt;
            store.put(existing);
          }
          cursor.continue();
        }
      };

      store.put(muteEntry);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          debug.log(
            `Recorded mute for: ${entry.subjectHandle || entry.subjectDid}`,
          );
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "recordMute");
  }

  async recordUnmute(subjectDid: string): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.MUTES], "readwrite");
      const store = transaction.objectStore(STORES.MUTES);
      const index = store.index("subjectDid");

      return new Promise<void>((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(subjectDid));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry = cursor.value as MuteHistoryEntry;
            if (entry.isActive) {
              entry.isActive = false;
              entry.unmutedAt = Date.now();
              store.put(entry);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    }, "recordUnmute");
  }

  async getMutes(
    options: { activeOnly?: boolean; limit?: number } = {},
  ): Promise<MuteHistoryEntry[]> {
    const { activeOnly = false, limit = 100 } = options;
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MUTES], "readonly");
    const store = transaction.objectStore(STORES.MUTES);
    const index = store.index("createdAt");

    const results: MuteHistoryEntry[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && results.length < limit) {
          const entry = cursor.value as MuteHistoryEntry;
          if (!activeOnly || entry.isActive) {
            results.push(entry);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Report Operations ====================

  async recordReport(
    entry: Omit<ReportHistoryEntry, "id" | "status">,
  ): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.REPORTS], "readwrite");
      const store = transaction.objectStore(STORES.REPORTS);

      const reportEntry: ReportHistoryEntry = {
        ...entry,
        id: `${entry.subjectUri}_${entry.createdAt}`,
        status: "pending",
      };

      store.put(reportEntry);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          debug.log(`Recorded report for: ${entry.subjectUri}`);
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "recordReport");
  }

  async updateReportStatus(
    id: string,
    status: ReportHistoryEntry["status"],
  ): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.REPORTS], "readwrite");
      const store = transaction.objectStore(STORES.REPORTS);

      return new Promise<void>((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          const entry = request.result as ReportHistoryEntry | undefined;
          if (entry) {
            entry.status = status;
            store.put(entry);
          }
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }, "updateReportStatus");
  }

  async getReports(
    options: { status?: ReportHistoryEntry["status"]; limit?: number } = {},
  ): Promise<ReportHistoryEntry[]> {
    const { status, limit = 100 } = options;
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.REPORTS], "readonly");
    const store = transaction.objectStore(STORES.REPORTS);
    const index = store.index("createdAt");

    const results: ReportHistoryEntry[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && results.length < limit) {
          const entry = cursor.value as ReportHistoryEntry;
          if (!status || entry.status === status) {
            results.push(entry);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Search & Filter ====================

  async searchHistory(filter: ModerationHistoryFilter): Promise<{
    blocks: BlockHistoryEntry[];
    mutes: MuteHistoryEntry[];
    reports: ReportHistoryEntry[];
  }> {
    const { type, startDate, endDate, searchQuery, activeOnly } = filter;
    const query = searchQuery?.toLowerCase();

    const results: {
      blocks: BlockHistoryEntry[];
      mutes: MuteHistoryEntry[];
      reports: ReportHistoryEntry[];
    } = {
      blocks: [],
      mutes: [],
      reports: [],
    };

    // Search blocks if type not specified or is 'block'
    if (!type || type === "block") {
      const blocks = await this.getBlocks({ limit: 500 });
      results.blocks = blocks.filter((b) => {
        if (activeOnly && !b.isActive) return false;
        if (startDate && b.createdAt < startDate) return false;
        if (endDate && b.createdAt > endDate) return false;
        if (query) {
          return (
            b.subjectHandle?.toLowerCase().includes(query) ||
            b.subjectDisplayName?.toLowerCase().includes(query) ||
            b.subjectDid.toLowerCase().includes(query)
          );
        }
        return true;
      });
    }

    // Search mutes if type not specified or is 'mute'
    if (!type || type === "mute") {
      const mutes = await this.getMutes({ limit: 500 });
      results.mutes = mutes.filter((m) => {
        if (activeOnly && !m.isActive) return false;
        if (startDate && m.createdAt < startDate) return false;
        if (endDate && m.createdAt > endDate) return false;
        if (query) {
          return (
            m.subjectHandle?.toLowerCase().includes(query) ||
            m.subjectDisplayName?.toLowerCase().includes(query) ||
            m.subjectDid.toLowerCase().includes(query)
          );
        }
        return true;
      });
    }

    // Search reports if type not specified or is 'report'
    if (!type || type === "report") {
      const reports = await this.getReports({ limit: 500 });
      results.reports = reports.filter((r) => {
        if (startDate && r.createdAt < startDate) return false;
        if (endDate && r.createdAt > endDate) return false;
        if (query) {
          return (
            r.subjectHandle?.toLowerCase().includes(query) ||
            r.subjectDisplayName?.toLowerCase().includes(query) ||
            r.subjectText?.toLowerCase().includes(query) ||
            r.reason.toLowerCase().includes(query)
          );
        }
        return true;
      });
    }

    return results;
  }

  // ==================== Stats ====================

  async getStats(): Promise<ModerationHistoryStats> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [STORES.BLOCKS, STORES.MUTES, STORES.REPORTS],
      "readonly",
    );

    const blockStore = transaction.objectStore(STORES.BLOCKS);
    const muteStore = transaction.objectStore(STORES.MUTES);
    const reportStore = transaction.objectStore(STORES.REPORTS);

    const [
      totalBlocks,
      activeBlocks,
      totalMutes,
      activeMutes,
      totalReports,
      pendingReports,
    ] = await Promise.all([
      this.countStore(blockStore),
      this.countByIndex(blockStore, "isActive", true),
      this.countStore(muteStore),
      this.countByIndex(muteStore, "isActive", true),
      this.countStore(reportStore),
      this.countByIndex(reportStore, "status", "pending"),
    ]);

    return {
      totalBlocks,
      activeBlocks,
      totalMutes,
      activeMutes,
      totalReports,
      pendingReports,
    };
  }

  private countStore(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private countByIndex(
    store: IDBObjectStore,
    indexName: string,
    value: unknown,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const index = store.index(indexName);
      const request = index.count(IDBKeyRange.only(value));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Cleanup ====================

  async evictOldEntries(): Promise<{
    blocksDeleted: number;
    mutesDeleted: number;
    reportsDeleted: number;
  }> {
    const cutoffTime = Date.now() - LIMITS.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    const blocksDeleted = await this.evictOldFromStore(
      STORES.BLOCKS,
      cutoffTime,
    );
    const mutesDeleted = await this.evictOldFromStore(STORES.MUTES, cutoffTime);
    const reportsDeleted = await this.evictOldFromStore(
      STORES.REPORTS,
      cutoffTime,
    );

    return { blocksDeleted, mutesDeleted, reportsDeleted };
  }

  private async evictOldFromStore(
    storeName: string,
    cutoffTime: number,
  ): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const index = store.index("createdAt");

    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          debug.log(`Evicted ${deletedCount} old entries from ${storeName}`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.BLOCKS, STORES.MUTES, STORES.REPORTS],
        "readwrite",
      );

      transaction.objectStore(STORES.BLOCKS).clear();
      transaction.objectStore(STORES.MUTES).clear();
      transaction.objectStore(STORES.REPORTS).clear();

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          debug.log("Cleared all moderation history");
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "clearAll");
  }
}

export const moderationHistoryDB = ModerationHistoryDB.getInstance();
