/**
 * Abstract Storage Interface Types
 *
 * Platform-agnostic storage abstraction for cross-platform persistence.
 * Enables web/mobile storage implementations with a unified API.
 *
 * @module storage/abstract/types
 */

/**
 * Base entity interface - all stored entities should extend this
 */
export interface StorageEntity {
  /** Unique identifier for the entity */
  id: string;
  /** Timestamp when the entity was created */
  createdAt: string;
  /** Timestamp when the entity was last updated */
  updatedAt: string;
}

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /** Skip cache and read/write directly to storage */
  bypassCache?: boolean;
  /** Encryption level for this data */
  encryption?: EncryptionLevel;
  /** Custom TTL in milliseconds (for cached data) */
  ttl?: number;
}

/**
 * Encryption levels for stored data
 */
export type EncryptionLevel =
  | "none" // No encryption (public data, non-sensitive)
  | "standard" // AES-GCM encryption (user data)
  | "high"; // High-security encryption with additional key derivation (credentials, tokens)

/**
 * Query filter operators
 */
export interface QueryFilter<T> {
  /** Field to filter on */
  field: keyof T;
  /** Comparison operator */
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  /** Value to compare against */
  value: T[keyof T] | T[keyof T][];
}

/**
 * Query options for listing entities
 */
export interface QueryOptions<T extends StorageEntity = StorageEntity> {
  /** Filters to apply */
  filters?: QueryFilter<T>[];
  /** Field to sort by */
  sortBy?: keyof T;
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Maximum number of results */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T extends StorageEntity> {
  /** Array of entities */
  items: T[];
  /** Total count of matching entities */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Cursor for next page (if supported) */
  nextCursor?: string;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  /** Number of successful operations */
  success: number;
  /** Number of failed operations */
  failed: number;
  /** Error messages for failed operations */
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Storage backend status
 */
export type StorageStatus =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "degraded"
  | "error"
  | "closed";

/**
 * Storage health information
 */
export interface StorageHealth {
  /** Current status */
  status: StorageStatus;
  /** Status message */
  message?: string;
  /** Last successful operation timestamp */
  lastOperationAt?: number;
  /** Number of pending operations */
  pendingOperations?: number;
  /** Storage quota information */
  quota?: {
    used: number;
    available: number;
    total: number;
  };
}

/**
 * Migration information
 */
export interface MigrationInfo {
  /** Current schema version */
  currentVersion: number;
  /** Target schema version */
  targetVersion: number;
  /** Whether migration is needed */
  needsMigration: boolean;
  /** Migration steps to apply */
  steps?: string[];
}

/**
 * Storage provider metadata
 */
export interface StorageProviderMetadata {
  /** Provider name */
  name: string;
  /** Provider version */
  version: string;
  /** Platform this provider is for */
  platform: "web" | "ios" | "android" | "universal";
  /** Features supported by this provider */
  features: StorageProviderFeatures;
}

/**
 * Features supported by a storage provider
 */
export interface StorageProviderFeatures {
  /** Supports encryption */
  encryption: boolean;
  /** Supports indexing */
  indexing: boolean;
  /** Supports transactions */
  transactions: boolean;
  /** Supports full-text search */
  fullTextSearch: boolean;
  /** Supports offline mode */
  offline: boolean;
  /** Supports sync across devices */
  sync: boolean;
  /** Maximum storage size in bytes (-1 for unlimited) */
  maxStorageSize: number;
}

/**
 * Storage event types
 */
export type StorageEventType =
  | "created"
  | "updated"
  | "deleted"
  | "synced"
  | "error";

/**
 * Storage change event
 */
export interface StorageEvent<T extends StorageEntity = StorageEntity> {
  /** Event type */
  type: StorageEventType;
  /** Store name */
  store: string;
  /** Entity ID */
  entityId: string;
  /** Entity data (may be null for delete events) */
  entity?: T;
  /** Previous entity data (for updates) */
  previousEntity?: T;
  /** Timestamp of the event */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Listener for storage events
 */
export type StorageEventListener<T extends StorageEntity = StorageEntity> = (
  event: StorageEvent<T>,
) => void;

/**
 * Transaction context for multi-operation atomicity
 */
export interface TransactionContext {
  /** Transaction ID */
  id: string;
  /** Stores involved in this transaction */
  stores: string[];
  /** Transaction mode */
  mode: "readonly" | "readwrite";
  /** Abort the transaction */
  abort(): Promise<void>;
  /** Commit the transaction */
  commit(): Promise<void>;
}
