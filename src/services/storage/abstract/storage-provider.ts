/**
 * Abstract Storage Provider Interface
 *
 * Defines the contract for all storage implementations (web, iOS, Android).
 * This is the core abstraction that enables cross-platform persistence.
 *
 * @module storage/abstract/storage-provider
 */

import type {
  BatchResult,
  MigrationInfo,
  PaginatedResult,
  QueryOptions,
  StorageEntity,
  StorageEvent,
  StorageEventListener,
  StorageHealth,
  StorageOptions,
  StorageProviderMetadata,
  TransactionContext,
} from "./types";

/**
 * IStorageProvider - Core storage abstraction interface
 *
 * Implementations:
 * - WebStorageAdapter: Dexie/IndexedDB for web browsers
 * - MobileStorageAdapter: SQLite/Realm for React Native (stubbed)
 *
 * Features:
 * - CRUD operations with type safety
 * - Querying with filters and pagination
 * - Batch operations for bulk updates
 * - Transaction support for atomicity
 * - Event-driven architecture for reactivity
 * - Encryption support for sensitive data
 * - Health monitoring and diagnostics
 */
export interface IStorageProvider {
  // ==================== Lifecycle ====================

  /**
   * Initialize the storage provider
   * Must be called before any other operations
   */
  initialize(): Promise<void>;

  /**
   * Close the storage provider and release resources
   */
  close(): Promise<void>;

  /**
   * Check if the storage provider is available on this platform
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider metadata and capabilities
   */
  getMetadata(): StorageProviderMetadata;

  /**
   * Get current health status
   */
  getHealth(): Promise<StorageHealth>;

  // ==================== CRUD Operations ====================

  /**
   * Get a single entity by ID
   * @param store - Store/collection name
   * @param id - Entity ID
   * @param options - Storage options
   * @returns Entity or null if not found
   */
  get<T extends StorageEntity>(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<T | null>;

  /**
   * Get multiple entities by IDs
   * @param store - Store/collection name
   * @param ids - Array of entity IDs
   * @param options - Storage options
   * @returns Array of entities (excludes not found)
   */
  getMany<T extends StorageEntity>(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<T[]>;

  /**
   * Get all entities from a store
   * @param store - Store/collection name
   * @param options - Storage options
   * @returns Array of all entities
   */
  getAll<T extends StorageEntity>(
    store: string,
    options?: StorageOptions,
  ): Promise<T[]>;

  /**
   * Create or update an entity (upsert)
   * @param store - Store/collection name
   * @param entity - Entity to save
   * @param options - Storage options
   */
  put<T extends StorageEntity>(
    store: string,
    entity: T,
    options?: StorageOptions,
  ): Promise<void>;

  /**
   * Create or update multiple entities
   * @param store - Store/collection name
   * @param entities - Array of entities to save
   * @param options - Storage options
   * @returns Batch result
   */
  putMany<T extends StorageEntity>(
    store: string,
    entities: T[],
    options?: StorageOptions,
  ): Promise<BatchResult>;

  /**
   * Delete an entity by ID
   * @param store - Store/collection name
   * @param id - Entity ID
   * @param options - Storage options
   */
  delete(store: string, id: string, options?: StorageOptions): Promise<void>;

  /**
   * Delete multiple entities by IDs
   * @param store - Store/collection name
   * @param ids - Array of entity IDs
   * @param options - Storage options
   * @returns Batch result
   */
  deleteMany(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<BatchResult>;

  /**
   * Clear all entities from a store
   * @param store - Store/collection name
   */
  clear(store: string): Promise<void>;

  /**
   * Check if an entity exists
   * @param store - Store/collection name
   * @param id - Entity ID
   */
  exists(store: string, id: string): Promise<boolean>;

  /**
   * Count entities in a store
   * @param store - Store/collection name
   * @param query - Optional query options for filtered count
   */
  count<T extends StorageEntity>(
    store: string,
    query?: QueryOptions<T>,
  ): Promise<number>;

  // ==================== Querying ====================

  /**
   * Query entities with filters and pagination
   * @param store - Store/collection name
   * @param query - Query options
   * @returns Paginated result
   */
  query<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<PaginatedResult<T>>;

  /**
   * Find first entity matching query
   * @param store - Store/collection name
   * @param query - Query options
   * @returns First matching entity or null
   */
  findOne<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<T | null>;

  // ==================== Transactions ====================

  /**
   * Begin a transaction for atomic operations
   * @param stores - Stores involved in the transaction
   * @param mode - Transaction mode
   * @returns Transaction context
   */
  beginTransaction(
    stores: string[],
    mode: "readonly" | "readwrite",
  ): Promise<TransactionContext>;

  /**
   * Execute operations within a transaction
   * @param stores - Stores involved
   * @param mode - Transaction mode
   * @param operations - Async function with operations
   */
  transaction<T>(
    stores: string[],
    mode: "readonly" | "readwrite",
    operations: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T>;

  // ==================== Events ====================

  /**
   * Subscribe to storage events for a store
   * @param store - Store to watch (or '*' for all stores)
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  subscribe<T extends StorageEntity>(
    store: string,
    listener: StorageEventListener<T>,
  ): () => void;

  /**
   * Emit a storage event (for internal use)
   */
  emit<T extends StorageEntity>(event: StorageEvent<T>): void;

  // ==================== Migration ====================

  /**
   * Get migration information
   */
  getMigrationInfo(): Promise<MigrationInfo>;

  /**
   * Run pending migrations
   */
  migrate(): Promise<void>;

  // ==================== Utilities ====================

  /**
   * Export all data from the provider
   * @returns JSON-serializable data
   */
  exportData(): Promise<Record<string, StorageEntity[]>>;

  /**
   * Import data into the provider
   * @param data - Data to import
   * @param options - Import options
   */
  importData(
    data: Record<string, StorageEntity[]>,
    options?: { overwrite?: boolean },
  ): Promise<BatchResult>;
}

/**
 * Abstract base class for storage providers
 * Provides common functionality and event handling
 */
export abstract class BaseStorageProvider implements IStorageProvider {
  protected listeners: Map<string, Set<StorageEventListener>> = new Map();
  protected initialized = false;

  // ==================== Abstract Methods ====================

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract isAvailable(): Promise<boolean>;
  abstract getMetadata(): StorageProviderMetadata;
  abstract getHealth(): Promise<StorageHealth>;

  abstract get<T extends StorageEntity>(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<T | null>;
  abstract getMany<T extends StorageEntity>(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<T[]>;
  abstract getAll<T extends StorageEntity>(
    store: string,
    options?: StorageOptions,
  ): Promise<T[]>;
  abstract put<T extends StorageEntity>(
    store: string,
    entity: T,
    options?: StorageOptions,
  ): Promise<void>;
  abstract putMany<T extends StorageEntity>(
    store: string,
    entities: T[],
    options?: StorageOptions,
  ): Promise<BatchResult>;
  abstract delete(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<void>;
  abstract deleteMany(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<BatchResult>;
  abstract clear(store: string): Promise<void>;
  abstract exists(store: string, id: string): Promise<boolean>;
  abstract count<T extends StorageEntity>(
    store: string,
    query?: QueryOptions<T>,
  ): Promise<number>;

  abstract query<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<PaginatedResult<T>>;
  abstract findOne<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<T | null>;

  abstract beginTransaction(
    stores: string[],
    mode: "readonly" | "readwrite",
  ): Promise<TransactionContext>;
  abstract transaction<T>(
    stores: string[],
    mode: "readonly" | "readwrite",
    operations: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T>;

  abstract getMigrationInfo(): Promise<MigrationInfo>;
  abstract migrate(): Promise<void>;

  abstract exportData(): Promise<Record<string, StorageEntity[]>>;
  abstract importData(
    data: Record<string, StorageEntity[]>,
    options?: { overwrite?: boolean },
  ): Promise<BatchResult>;

  // ==================== Common Implementations ====================

  /**
   * Subscribe to storage events
   */
  subscribe<T extends StorageEntity>(
    store: string,
    listener: StorageEventListener<T>,
  ): () => void {
    if (!this.listeners.has(store)) {
      this.listeners.set(store, new Set());
    }
    this.listeners
      .get(store)!
      .add(listener as StorageEventListener<StorageEntity>);

    return () => {
      const storeListeners = this.listeners.get(store);
      if (storeListeners) {
        storeListeners.delete(listener as StorageEventListener<StorageEntity>);
      }
    };
  }

  /**
   * Emit a storage event
   */
  emit<T extends StorageEntity>(event: StorageEvent<T>): void {
    // Emit to specific store listeners
    const storeListeners = this.listeners.get(event.store);
    if (storeListeners) {
      storeListeners.forEach((listener) =>
        listener(event as StorageEvent<StorageEntity>),
      );
    }

    // Emit to wildcard listeners
    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      wildcardListeners.forEach((listener) =>
        listener(event as StorageEvent<StorageEntity>),
      );
    }
  }

  /**
   * Ensure provider is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "Storage provider not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Generate timestamps for new/updated entities
   */
  protected withTimestamps<T extends StorageEntity>(
    entity: T,
    isNew: boolean,
  ): T {
    const now = new Date().toISOString();
    return {
      ...entity,
      createdAt: isNew ? now : entity.createdAt,
      updatedAt: now,
    };
  }
}
