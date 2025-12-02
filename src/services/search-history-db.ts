import { debug } from "@bsky/shared";

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters?: SearchFilters;
  timestamp: Date;
  resultCount?: number;
}

export interface SearchFilters {
  hasMedia?: boolean;
  fromUsers?: string[];
  sinceDate?: string;
  untilDate?: string;
  language?: string;
  sort?: "latest" | "top";
}

const MAX_HISTORY_ENTRIES = 50;

class SearchHistoryDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "BlueskySearchHistory";
  private readonly DB_VERSION = 1;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open search history database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("history")) {
          const historyStore = db.createObjectStore("history", {
            keyPath: "id",
          });
          historyStore.createIndex("query", "query", { unique: false });
          historyStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  async addSearchEntry(
    query: string,
    filters?: SearchFilters,
    resultCount?: number,
  ): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readwrite");
      const store = transaction.objectStore("history");

      const entry: SearchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        query: query.trim(),
        filters,
        timestamp: new Date(),
        resultCount,
      };

      const request = store.add(entry);

      request.onsuccess = () => {
        // Cleanup old entries after adding
        this.cleanupOldEntries().catch((error) =>
          debug.error("Failed to cleanup old search entries:", error),
        );
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getSearchHistory(limit: number = 20): Promise<SearchHistoryEntry[]> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readonly");
      const store = transaction.objectStore("history");
      const index = store.index("timestamp");
      const entries: SearchHistoryEntry[] = [];

      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && entries.length < limit) {
          entries.push(cursor.value);
          cursor.continue();
        } else {
          resolve(entries);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async searchHistory(searchTerm: string): Promise<SearchHistoryEntry[]> {
    await this.initialize();
    const db = this.ensureDB();
    const searchLower = searchTerm.toLowerCase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readonly");
      const store = transaction.objectStore("history");
      const entries: SearchHistoryEntry[] = [];

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as SearchHistoryEntry;
          if (entry.query.toLowerCase().includes(searchLower)) {
            entries.push(entry);
          }
          cursor.continue();
        } else {
          // Sort by timestamp descending
          entries.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );
          resolve(entries.slice(0, 20));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readwrite");
      const store = transaction.objectStore("history");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearHistory(): Promise<void> {
    await this.initialize();
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readwrite");
      const store = transaction.objectStore("history");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async cleanupOldEntries(): Promise<void> {
    const db = this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["history"], "readwrite");
      const store = transaction.objectStore("history");
      const index = store.index("timestamp");
      const entries: { id: string; timestamp: Date }[] = [];

      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          entries.push({
            id: cursor.value.id,
            timestamp: cursor.value.timestamp,
          });
          cursor.continue();
        } else {
          // If we have more than MAX_HISTORY_ENTRIES, delete the oldest ones
          if (entries.length > MAX_HISTORY_ENTRIES) {
            entries.sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            );
            const toDelete = entries.slice(MAX_HISTORY_ENTRIES);

            const deleteTransaction = db.transaction(["history"], "readwrite");
            const deleteStore = deleteTransaction.objectStore("history");

            for (const entry of toDelete) {
              deleteStore.delete(entry.id);
            }

            deleteTransaction.oncomplete = () => resolve();
            deleteTransaction.onerror = () => reject(deleteTransaction.error);
          } else {
            resolve();
          }
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let searchHistoryDBInstance: SearchHistoryDB | null = null;

export async function getSearchHistoryDB(): Promise<SearchHistoryDB> {
  if (!searchHistoryDBInstance) {
    searchHistoryDBInstance = new SearchHistoryDB();
    await searchHistoryDBInstance.initialize();
  }
  return searchHistoryDBInstance;
}

export { SearchHistoryDB };
