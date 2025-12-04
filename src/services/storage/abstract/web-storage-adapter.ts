/**
 * Web Storage Adapter
 *
 * Dexie-based IndexedDB implementation of IStorageProvider.
 * Provides persistent storage for web browsers with full support for:
 * - CRUD operations with automatic indexing
 * - Querying with filters and pagination
 * - Transaction support
 * - Event-driven reactivity
 * - Optional encryption via WebCrypto
 *
 * @module storage/abstract/web-storage-adapter
 */

import Dexie, { type Table } from "dexie";
import { createLogger } from "../../../utils/logger";
import type {
  BatchResult,
  EncryptionLevel,
  MigrationInfo,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
  StorageEntity,
  StorageHealth,
  StorageOptions,
  StorageProviderFeatures,
  StorageProviderMetadata,
  StorageStatus,
  TransactionContext,
} from "./types";
import { BaseStorageProvider } from "./storage-provider";

const logger = createLogger("WebStorageAdapter");

// Database configuration
const DB_NAME = "shadowsky_storage";
const DB_VERSION = 1;

/**
 * Schema definition for dynamic stores
 */
interface StoreSchema {
  /** Primary key field */
  keyPath: string;
  /** Indexed fields */
  indexes: string[];
}

/**
 * Default schema for stores
 */
const DEFAULT_SCHEMA: StoreSchema = {
  keyPath: "id",
  indexes: ["createdAt", "updatedAt"],
};

/**
 * Predefined store schemas
 */
const STORE_SCHEMAS: Record<string, StoreSchema> = {
  columns: {
    keyPath: "id",
    indexes: ["type", "createdAt", "updatedAt"],
  },
  drafts: {
    keyPath: "id",
    indexes: ["createdAt", "updatedAt", "type"],
  },
  preferences: {
    keyPath: "id",
    indexes: ["updatedAt"],
  },
  cache: {
    keyPath: "id",
    indexes: ["expiresAt", "createdAt"],
  },
};

/**
 * Internal storage format with optional encryption
 */
interface StoredRecord {
  id: string;
  data: string; // JSON stringified or encrypted
  encrypted: boolean;
  encryptionLevel?: EncryptionLevel;
  iv?: Uint8Array;
  createdAt: string;
  updatedAt: string;
  // Additional indexed fields extracted from data
  [key: string]: unknown;
}

/**
 * Dexie database class for dynamic store access
 */
class StorageDatabase extends Dexie {
  // Dynamic tables are accessed via this.table(name)

  constructor() {
    super(DB_NAME);

    // Build schema from predefined stores
    const schema: Record<string, string> = {};
    for (const [storeName, storeSchema] of Object.entries(STORE_SCHEMAS)) {
      schema[storeName] = `${storeSchema.keyPath}, ${storeSchema.indexes.join(", ")}`;
    }

    this.version(DB_VERSION).stores(schema);
  }

  /**
   * Get or create a table for a store
   */
  getStore<T>(name: string): Table<T> {
    return this.table(name);
  }
}

/**
 * WebStorageAdapter - Dexie/IndexedDB implementation
 */
export class WebStorageAdapter extends BaseStorageProvider {
  private db: StorageDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private encryptionKey: CryptoKey | null = null;
  private status: StorageStatus = "uninitialized";
  private lastOperationAt: number = 0;

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.status = "initializing";
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Check availability
      if (!(await this.isAvailable())) {
        throw new Error("IndexedDB is not available");
      }

      // Open database
      this.db = new StorageDatabase();
      await this.db.open();

      // Initialize encryption key
      await this.initializeEncryption();

      this.initialized = true;
      this.status = "ready";
      logger.log("WebStorageAdapter initialized successfully");
    } catch (error) {
      this.status = "error";
      logger.error("Failed to initialize WebStorageAdapter:", error);
      throw error;
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Check if Web Crypto is available
      if (typeof crypto === "undefined" || !crypto.subtle) {
        logger.log("Web Crypto not available, encryption disabled");
        return;
      }

      // Try to load existing key from IndexedDB
      const existingKey = await this.loadEncryptionKey();
      if (existingKey) {
        this.encryptionKey = existingKey;
        return;
      }

      // Generate new encryption key
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true, // extractable for persistence
        ["encrypt", "decrypt"],
      );

      // Store the key
      await this.saveEncryptionKey(this.encryptionKey);
      logger.log("Encryption key initialized");
    } catch (error) {
      logger.error("Failed to initialize encryption:", error);
      // Continue without encryption
    }
  }

  private async loadEncryptionKey(): Promise<CryptoKey | null> {
    try {
      const stored = localStorage.getItem("shadowsky_storage_key");
      if (!stored) return null;

      const keyData = JSON.parse(stored);
      return crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    } catch {
      return null;
    }
  }

  private async saveEncryptionKey(key: CryptoKey): Promise<void> {
    try {
      const keyData = await crypto.subtle.exportKey("jwk", key);
      localStorage.setItem("shadowsky_storage_key", JSON.stringify(keyData));
    } catch (error) {
      logger.error("Failed to save encryption key:", error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    this.status = "closed";
    this.encryptionKey = null;
    this.initPromise = null;
    logger.log("WebStorageAdapter closed");
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!window.indexedDB) return false;

    // Test IndexedDB access
    try {
      const testDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("__test__", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      testDb.close();
      indexedDB.deleteDatabase("__test__");
      return true;
    } catch {
      return false;
    }
  }

  getMetadata(): StorageProviderMetadata {
    return {
      name: "WebStorageAdapter",
      version: "1.0.0",
      platform: "web",
      features: this.getFeatures(),
    };
  }

  private getFeatures(): StorageProviderFeatures {
    return {
      encryption: !!this.encryptionKey,
      indexing: true,
      transactions: true,
      fullTextSearch: false, // Could be added with lunr.js or similar
      offline: true,
      sync: false, // No built-in sync, could be added via AT Protocol
      maxStorageSize: -1, // Browser-managed quota
    };
  }

  async getHealth(): Promise<StorageHealth> {
    const health: StorageHealth = {
      status: this.status,
      lastOperationAt: this.lastOperationAt || undefined,
    };

    if (this.status === "ready" && navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        health.quota = {
          used: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
          total: estimate.quota || 0,
        };
      } catch {
        // Ignore quota estimation errors
      }
    }

    return health;
  }

  // ==================== CRUD Operations ====================

  async get<T extends StorageEntity>(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<T | null> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const record = await table.get(id);

      if (!record) return null;

      return this.deserializeRecord<T>(record, options);
    } catch (error) {
      logger.error(`Failed to get ${store}/${id}:`, error);
      throw error;
    }
  }

  async getMany<T extends StorageEntity>(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<T[]> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const records = await table.bulkGet(ids);

      const results: T[] = [];
      for (const record of records) {
        if (record) {
          results.push(await this.deserializeRecord<T>(record, options));
        }
      }

      return results;
    } catch (error) {
      logger.error(`Failed to getMany from ${store}:`, error);
      throw error;
    }
  }

  async getAll<T extends StorageEntity>(
    store: string,
    options?: StorageOptions,
  ): Promise<T[]> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const records = await table.toArray();

      const results: T[] = [];
      for (const record of records) {
        results.push(await this.deserializeRecord<T>(record, options));
      }

      return results;
    } catch (error) {
      logger.error(`Failed to getAll from ${store}:`, error);
      throw error;
    }
  }

  async put<T extends StorageEntity>(
    store: string,
    entity: T,
    options?: StorageOptions,
  ): Promise<void> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const existing = await table.get(entity.id);
      const isNew = !existing;

      const entityWithTimestamps = this.withTimestamps(entity, isNew);
      const record = await this.serializeRecord(entityWithTimestamps, options);

      await table.put(record);

      // Emit event
      this.emit({
        type: isNew ? "created" : "updated",
        store,
        entityId: entity.id,
        entity: entityWithTimestamps,
        previousEntity: existing
          ? await this.deserializeRecord<T>(existing)
          : undefined,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Failed to put ${store}/${entity.id}:`, error);
      throw error;
    }
  }

  async putMany<T extends StorageEntity>(
    store: string,
    entities: T[],
    options?: StorageOptions,
  ): Promise<BatchResult> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    const result: BatchResult = { success: 0, failed: 0, errors: [] };

    try {
      const table = this.db!.getStore<StoredRecord>(store);

      // Get existing records to determine if new or update
      const existingRecords = await table.bulkGet(entities.map((e) => e.id));
      const existingMap = new Map(
        existingRecords
          .filter((r): r is StoredRecord => r !== undefined)
          .map((r) => [r.id, r]),
      );

      const records: StoredRecord[] = [];
      for (const entity of entities) {
        try {
          const isNew = !existingMap.has(entity.id);
          const entityWithTimestamps = this.withTimestamps(entity, isNew);
          records.push(
            await this.serializeRecord(entityWithTimestamps, options),
          );
        } catch (error) {
          result.failed++;
          result.errors?.push({
            id: entity.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Bulk put
      await table.bulkPut(records);
      result.success = records.length;

      return result;
    } catch (error) {
      logger.error(`Failed to putMany in ${store}:`, error);
      throw error;
    }
  }

  async delete(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<void> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();
    // options is available for future use (e.g., soft delete)
    void options;

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const existing = await table.get(id);

      await table.delete(id);

      // Emit event
      if (existing) {
        this.emit({
          type: "deleted",
          store,
          entityId: id,
          previousEntity: await this.deserializeRecord(existing),
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error(`Failed to delete ${store}/${id}:`, error);
      throw error;
    }
  }

  async deleteMany(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<BatchResult> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();
    // options is available for future use
    void options;

    const result: BatchResult = { success: 0, failed: 0, errors: [] };

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      await table.bulkDelete(ids);
      result.success = ids.length;

      return result;
    } catch (error) {
      logger.error(`Failed to deleteMany from ${store}:`, error);
      result.failed = ids.length;
      throw error;
    }
  }

  async clear(store: string): Promise<void> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      await table.clear();
      logger.log(`Cleared store: ${store}`);
    } catch (error) {
      logger.error(`Failed to clear ${store}:`, error);
      throw error;
    }
  }

  async exists(store: string, id: string): Promise<boolean> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);
      const count = await table.where("id").equals(id).count();
      return count > 0;
    } catch (error) {
      logger.error(`Failed to check exists ${store}/${id}:`, error);
      throw error;
    }
  }

  async count<T extends StorageEntity>(
    store: string,
    query?: QueryOptions<T>,
  ): Promise<number> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);

      if (!query?.filters?.length) {
        return table.count();
      }

      // Apply filters
      const filtered = await this.applyFilters(table, query.filters);
      return filtered.length;
    } catch (error) {
      logger.error(`Failed to count ${store}:`, error);
      throw error;
    }
  }

  // ==================== Querying ====================

  async query<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<PaginatedResult<T>> {
    this.ensureInitialized();
    this.lastOperationAt = Date.now();

    try {
      const table = this.db!.getStore<StoredRecord>(store);

      // Get all records (with optional filters)
      let records: StoredRecord[];
      if (query.filters?.length) {
        records = await this.applyFilters(table, query.filters);
      } else {
        records = await table.toArray();
      }

      // Sort
      if (query.sortBy) {
        const sortField = query.sortBy as string;
        const sortDir = query.sortDirection === "desc" ? -1 : 1;
        records.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal < bVal) return -1 * sortDir;
          if (aVal > bVal) return 1 * sortDir;
          return 0;
        });
      }

      // Paginate
      const total = records.length;
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      const paginatedRecords = records.slice(offset, offset + limit);

      // Deserialize
      const items: T[] = [];
      for (const record of paginatedRecords) {
        items.push(await this.deserializeRecord<T>(record));
      }

      return {
        items,
        total,
        hasMore: offset + items.length < total,
      };
    } catch (error) {
      logger.error(`Failed to query ${store}:`, error);
      throw error;
    }
  }

  async findOne<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<T | null> {
    const result = await this.query<T>(store, { ...query, limit: 1 });
    return result.items[0] || null;
  }

  private async applyFilters<T extends StorageEntity>(
    table: Table<StoredRecord>,
    filters: QueryFilter<T>[],
  ): Promise<StoredRecord[]> {
    // Start with all records
    let records = await table.toArray();

    // Apply each filter
    for (const filter of filters) {
      const field = filter.field as string;
      records = records.filter((record) => {
        const value = record[field];
        return this.matchFilter(value, filter.operator, filter.value);
      });
    }

    return records;
  }

  private matchFilter(
    value: unknown,
    operator: QueryFilter<StorageEntity>["operator"],
    filterValue: unknown,
  ): boolean {
    switch (operator) {
      case "eq":
        return value === filterValue;
      case "ne":
        return value !== filterValue;
      case "gt":
        return (value as number) > (filterValue as number);
      case "gte":
        return (value as number) >= (filterValue as number);
      case "lt":
        return (value as number) < (filterValue as number);
      case "lte":
        return (value as number) <= (filterValue as number);
      case "in":
        return (filterValue as unknown[]).includes(value);
      case "contains":
        return String(value)
          .toLowerCase()
          .includes(String(filterValue).toLowerCase());
      default:
        return true;
    }
  }

  // ==================== Transactions ====================

  async beginTransaction(
    stores: string[],
    mode: "readonly" | "readwrite",
  ): Promise<TransactionContext> {
    this.ensureInitialized();

    const id = crypto.randomUUID();
    let aborted = false;

    const ctx: TransactionContext = {
      id,
      stores,
      mode,
      abort: async () => {
        aborted = true;
      },
      commit: async () => {
        if (aborted) {
          throw new Error("Transaction was aborted");
        }
      },
    };

    return ctx;
  }

  async transaction<T>(
    stores: string[],
    mode: "readonly" | "readwrite",
    operations: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    this.ensureInitialized();

    return this.db!.transaction(
      mode === "readwrite" ? "rw" : "r",
      stores.map((s) => this.db!.table(s)),
      async () => {
        const ctx = await this.beginTransaction(stores, mode);
        try {
          const result = await operations(ctx);
          await ctx.commit();
          return result;
        } catch (error) {
          await ctx.abort();
          throw error;
        }
      },
    );
  }

  // ==================== Migration ====================

  async getMigrationInfo(): Promise<MigrationInfo> {
    return {
      currentVersion: DB_VERSION,
      targetVersion: DB_VERSION,
      needsMigration: false,
    };
  }

  async migrate(): Promise<void> {
    // Dexie handles migrations automatically via version()
    logger.log("No manual migrations needed, Dexie handles them");
  }

  // ==================== Import/Export ====================

  async exportData(): Promise<Record<string, StorageEntity[]>> {
    this.ensureInitialized();

    const result: Record<string, StorageEntity[]> = {};

    for (const storeName of Object.keys(STORE_SCHEMAS)) {
      try {
        const entities = await this.getAll(storeName);
        result[storeName] = entities;
      } catch {
        // Store might not exist yet
        result[storeName] = [];
      }
    }

    return result;
  }

  async importData(
    data: Record<string, StorageEntity[]>,
    options?: { overwrite?: boolean },
  ): Promise<BatchResult> {
    this.ensureInitialized();

    const result: BatchResult = { success: 0, failed: 0, errors: [] };

    for (const [storeName, entities] of Object.entries(data)) {
      try {
        if (options?.overwrite) {
          await this.clear(storeName);
        }

        const putResult = await this.putMany(storeName, entities);
        result.success += putResult.success;
        result.failed += putResult.failed;
        if (putResult.errors) {
          result.errors?.push(...putResult.errors);
        }
      } catch (error) {
        result.failed += entities.length;
        result.errors?.push({
          id: storeName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  // ==================== Serialization ====================

  private async serializeRecord<T extends StorageEntity>(
    entity: T,
    options?: StorageOptions,
  ): Promise<StoredRecord> {
    const encryptionLevel = options?.encryption || "none";
    const shouldEncrypt =
      encryptionLevel !== "none" && this.encryptionKey !== null;

    let data: string;
    let iv: Uint8Array | undefined;

    if (shouldEncrypt) {
      const encrypted = await this.encrypt(JSON.stringify(entity));
      data = this.arrayBufferToBase64(encrypted.data);
      iv = encrypted.iv;
    } else {
      data = JSON.stringify(entity);
    }

    // Extract indexed fields from entity for querying
    const schema = STORE_SCHEMAS[Object.keys(STORE_SCHEMAS)[0]] || DEFAULT_SCHEMA;
    const indexedFields: Record<string, unknown> = {};
    for (const field of schema.indexes) {
      if (field in entity) {
        indexedFields[field] = entity[field as keyof T];
      }
    }

    return {
      id: entity.id,
      data,
      encrypted: shouldEncrypt,
      encryptionLevel: shouldEncrypt ? encryptionLevel : undefined,
      iv,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...indexedFields,
    };
  }

  private async deserializeRecord<T extends StorageEntity>(
    record: StoredRecord,
    _options?: StorageOptions,
  ): Promise<T> {
    if (record.encrypted && record.iv && this.encryptionKey) {
      const encryptedData = this.base64ToArrayBuffer(record.data);
      const decrypted = await this.decrypt(encryptedData, record.iv);
      return JSON.parse(decrypted);
    }

    return JSON.parse(record.data);
  }

  // ==================== Encryption Helpers ====================

  private async encrypt(
    data: string,
  ): Promise<{ data: ArrayBuffer; iv: Uint8Array }> {
    if (!this.encryptionKey) {
      throw new Error("Encryption key not available");
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      this.encryptionKey,
      encoder.encode(data),
    );

    return { data: encryptedData, iv };
  }

  private async decrypt(
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error("Encryption key not available");
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      this.encryptionKey,
      encryptedData,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Singleton instance
 */
let webStorageAdapterInstance: WebStorageAdapter | null = null;

/**
 * Get the singleton WebStorageAdapter instance
 */
export function getWebStorageAdapter(): WebStorageAdapter {
  if (!webStorageAdapterInstance) {
    webStorageAdapterInstance = new WebStorageAdapter();
  }
  return webStorageAdapterInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export async function resetWebStorageAdapter(): Promise<void> {
  if (webStorageAdapterInstance) {
    await webStorageAdapterInstance.close();
    webStorageAdapterInstance = null;
  }
}
