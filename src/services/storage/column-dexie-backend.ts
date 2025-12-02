/**
 * Dexie-based column storage backend
 *
 * Provides async IndexedDB storage for column configurations,
 * replacing the synchronous localStorage implementation to prevent UI jank.
 *
 * Features:
 * - Async IndexedDB operations via Dexie.js
 * - Automatic migration from localStorage on first run
 * - Same API as ColumnLocalStorageBackend for compatibility
 */

import { AtpAgent } from "@atproto/api";
import Dexie, { type Table } from "dexie";
import { createLogger } from "../../utils/logger";
import { ColumnStorageBackend } from "./column-storage-backend";
import { LOCAL_STORAGE_KEYS } from "./storage-constants";
import { Column, StoredColumn } from "./types";

const logger = createLogger("ColumnDexieBackend");

// Database name and version
const DB_NAME = "ColumnStorageDB";
const DB_VERSION = 1;

// Migration flag key in localStorage
const DEXIE_MIGRATION_KEY = "shadowsky_columns_dexie_migrated";

/**
 * Column entry stored in IndexedDB
 */
export interface ColumnEntry extends StoredColumn {
  /** Primary key - same as column id */
  id: string;
}

/**
 * Dexie database for column storage
 */
class ColumnStorageDB extends Dexie {
  columns!: Table<ColumnEntry>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      // Primary key is id, indexed by type for potential queries
      columns: "id, type",
    });
  }
}

export class ColumnDexieBackend implements ColumnStorageBackend {
  private db: ColumnStorageDB | null = null;
  private initPromise: Promise<void> | null = null;

  setAgent(_agent: AtpAgent | null): void {
    // Dexie storage doesn't need agent
  }

  /**
   * Initialize the database and run migration if needed
   */
  private async ensureInitialized(): Promise<ColumnStorageDB> {
    if (this.db) {
      return this.db;
    }

    // Prevent concurrent initialization
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;

    if (!this.db) {
      throw new Error("ColumnDexieBackend failed to initialize");
    }
    return this.db;
  }

  private async initialize(): Promise<void> {
    try {
      this.db = new ColumnStorageDB();
      await this.db.open();
      logger.log("ColumnDexieBackend initialized");

      // Check if we need to migrate from localStorage
      await this.migrateFromLocalStorage();
    } catch (error) {
      logger.error("Failed to initialize ColumnDexieBackend:", error);
      throw error;
    }
  }

  /**
   * Migrate existing data from localStorage to Dexie on first run
   */
  private async migrateFromLocalStorage(): Promise<void> {
    // Check if already migrated
    const migrated = localStorage.getItem(DEXIE_MIGRATION_KEY);
    if (migrated === "true") {
      return;
    }

    try {
      // Check for existing data in localStorage
      const localStorageData = localStorage.getItem(LOCAL_STORAGE_KEYS.COLUMNS);
      const legacyData = localStorage.getItem(
        LOCAL_STORAGE_KEYS.COLUMNS_LEGACY,
      );

      const dataToMigrate = localStorageData || legacyData;

      if (dataToMigrate) {
        const columns = JSON.parse(dataToMigrate) as Column[];

        if (Array.isArray(columns) && columns.length > 0) {
          const db = await this.ensureInitialized();

          // Store each column in Dexie
          const now = new Date().toISOString();
          const entries: ColumnEntry[] = columns.map((col) => ({
            ...col,
            createdAt: (col as StoredColumn).createdAt || now,
            updatedAt: (col as StoredColumn).updatedAt || now,
          }));

          await db.columns.bulkPut(entries);

          logger.log(
            `Migrated ${columns.length} columns from localStorage to Dexie`,
          );

          // Clear localStorage data after successful migration
          localStorage.removeItem(LOCAL_STORAGE_KEYS.COLUMNS);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.COLUMNS_LEGACY);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.COLUMNS_MIGRATED);
        }
      }

      // Mark migration as complete
      localStorage.setItem(DEXIE_MIGRATION_KEY, "true");
      logger.log("localStorage to Dexie migration complete");
    } catch (error) {
      logger.error("Failed to migrate from localStorage:", error);
      // Don't throw - allow the app to continue even if migration fails
      // The user can still use the new storage, they just won't have their old data
    }
  }

  async saveColumns(columns: Column[]): Promise<void> {
    const db = await this.ensureInitialized();

    try {
      const now = new Date().toISOString();
      const entries: ColumnEntry[] = columns.map((col) => ({
        ...col,
        createdAt: (col as StoredColumn).createdAt || now,
        updatedAt: now,
      }));

      // Clear existing columns and add new ones in a transaction
      await db.transaction("rw", db.columns, async () => {
        await db.columns.clear();
        await db.columns.bulkPut(entries);
      });
    } catch (error) {
      logger.error("Failed to save columns to Dexie:", error);
      throw error;
    }
  }

  async loadColumns(): Promise<Column[]> {
    const db = await this.ensureInitialized();

    try {
      const entries = await db.columns.toArray();
      return entries;
    } catch (error) {
      logger.error("Failed to load columns from Dexie:", error);
      return [];
    }
  }

  async addColumn(column: Column): Promise<void> {
    const db = await this.ensureInitialized();

    try {
      const existing = await db.columns.get(column.id);

      if (!existing) {
        const now = new Date().toISOString();
        const entry: ColumnEntry = {
          ...column,
          createdAt: now,
          updatedAt: now,
        };
        await db.columns.put(entry);
      }
    } catch (error) {
      logger.error("Failed to add column to Dexie:", error);
      throw error;
    }
  }

  async updateColumn(
    columnId: string,
    updates: Partial<Column>,
  ): Promise<void> {
    const db = await this.ensureInitialized();

    try {
      const existing = await db.columns.get(columnId);

      if (existing) {
        const updated: ColumnEntry = {
          ...existing,
          ...updates,
          id: columnId, // Ensure id is not overwritten
          updatedAt: new Date().toISOString(),
        };
        await db.columns.put(updated);
      }
    } catch (error) {
      logger.error("Failed to update column in Dexie:", error);
      throw error;
    }
  }

  async deleteColumn(columnId: string): Promise<void> {
    const db = await this.ensureInitialized();

    try {
      await db.columns.delete(columnId);
    } catch (error) {
      logger.error("Failed to delete column from Dexie:", error);
      throw error;
    }
  }

  async migrateFrom(sourceBackend: ColumnStorageBackend): Promise<void> {
    const columns = await sourceBackend.loadColumns();
    await this.saveColumns(columns);
  }

  async updateColumnFeedPreference(
    columnId: string,
    feedUri: string,
  ): Promise<void> {
    const db = await this.ensureInitialized();

    try {
      const column = await db.columns.get(columnId);

      if (column && column.type === "feed") {
        await db.columns.update(columnId, {
          data: feedUri,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to update column feed preference in Dexie:", error);
      throw error;
    }
  }

  /**
   * Close the database connection (useful for cleanup/testing)
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Check if migration from localStorage has been completed
   */
  static isMigrationComplete(): boolean {
    return localStorage.getItem(DEXIE_MIGRATION_KEY) === "true";
  }

  /**
   * Reset migration flag (useful for testing)
   */
  static resetMigration(): void {
    localStorage.removeItem(DEXIE_MIGRATION_KEY);
  }
}
