/**
 * Mobile Storage Adapter (Stub)
 *
 * Stubbed implementation of IStorageProvider for React Native mobile apps.
 * This will be implemented with SQLite or Realm when mobile support is added.
 *
 * Planned features:
 * - SQLite via expo-sqlite or react-native-sqlite-storage
 * - Native encryption via iOS Keychain / Android Keystore
 * - Background sync support
 * - Offline-first architecture
 *
 * @module storage/abstract/mobile-storage-adapter
 */

import { createLogger } from "../../../utils/logger";
import { BaseStorageProvider } from "./storage-provider";
import type {
  BatchResult,
  MigrationInfo,
  PaginatedResult,
  QueryOptions,
  StorageEntity,
  StorageHealth,
  StorageOptions,
  StorageProviderFeatures,
  StorageProviderMetadata,
  TransactionContext,
} from "./types";

const logger = createLogger("MobileStorageAdapter");

/**
 * Mobile platform type
 */
export type MobilePlatform = "ios" | "android";

/**
 * Mobile storage configuration
 */
export interface MobileStorageConfig {
  /** Target platform */
  platform: MobilePlatform;
  /** Database file name */
  databaseName?: string;
  /** Enable native encryption */
  enableEncryption?: boolean;
  /** Use secure enclave for keys (iOS) */
  useSecureEnclave?: boolean;
  /** Enable WAL mode for SQLite */
  enableWAL?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MobileStorageConfig = {
  platform: "ios",
  databaseName: "shadowsky.db",
  enableEncryption: true,
  useSecureEnclave: true,
  enableWAL: true,
};

/**
 * MobileStorageAdapter - Stubbed implementation for React Native
 *
 * This is a placeholder that throws "not implemented" errors.
 * Actual implementation will be added when React Native support is prioritized.
 */
export class MobileStorageAdapter extends BaseStorageProvider {
  private config: MobileStorageConfig;

  constructor(config: Partial<MobileStorageConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.log(`MobileStorageAdapter stub created for ${this.config.platform}`);
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    logger.log("MobileStorageAdapter.initialize() - stub");
    this.throwNotImplemented("initialize");
  }

  async close(): Promise<void> {
    logger.log("MobileStorageAdapter.close() - stub");
    this.initialized = false;
  }

  async isAvailable(): Promise<boolean> {
    // Check if running in React Native environment
    // In React Native, __DEV__ is a global boolean
    const globalAny = global as unknown as { __DEV__?: boolean };
    const isReactNative =
      typeof globalAny !== "undefined" && globalAny.__DEV__ !== undefined;
    return isReactNative;
  }

  getMetadata(): StorageProviderMetadata {
    return {
      name: "MobileStorageAdapter",
      version: "0.1.0-stub",
      platform: this.config.platform,
      features: this.getFeatures(),
    };
  }

  private getFeatures(): StorageProviderFeatures {
    return {
      encryption: this.config.enableEncryption ?? true,
      indexing: true,
      transactions: true,
      fullTextSearch: true, // SQLite FTS5
      offline: true,
      sync: true, // Planned with AT Protocol
      maxStorageSize: -1, // Device-dependent
    };
  }

  async getHealth(): Promise<StorageHealth> {
    return {
      status: "uninitialized",
      message: "Mobile storage adapter is a stub - not implemented",
    };
  }

  // ==================== CRUD Operations ====================

  async get<T extends StorageEntity>(
    store: string,
    id: string,
    _options?: StorageOptions,
  ): Promise<T | null> {
    logger.log(`MobileStorageAdapter.get(${store}, ${id}) - stub`);
    this.throwNotImplemented("get");
  }

  async getMany<T extends StorageEntity>(
    store: string,
    ids: string[],
    _options?: StorageOptions,
  ): Promise<T[]> {
    logger.log(
      `MobileStorageAdapter.getMany(${store}, ${ids.length} ids) - stub`,
    );
    this.throwNotImplemented("getMany");
  }

  async getAll<T extends StorageEntity>(
    store: string,
    _options?: StorageOptions,
  ): Promise<T[]> {
    logger.log(`MobileStorageAdapter.getAll(${store}) - stub`);
    this.throwNotImplemented("getAll");
  }

  async put<T extends StorageEntity>(
    store: string,
    entity: T,
    _options?: StorageOptions,
  ): Promise<void> {
    logger.log(`MobileStorageAdapter.put(${store}, ${entity.id}) - stub`);
    this.throwNotImplemented("put");
  }

  async putMany<T extends StorageEntity>(
    store: string,
    entities: T[],
    _options?: StorageOptions,
  ): Promise<BatchResult> {
    logger.log(
      `MobileStorageAdapter.putMany(${store}, ${entities.length} entities) - stub`,
    );
    this.throwNotImplemented("putMany");
  }

  async delete(
    store: string,
    id: string,
    _options?: StorageOptions,
  ): Promise<void> {
    logger.log(`MobileStorageAdapter.delete(${store}, ${id}) - stub`);
    this.throwNotImplemented("delete");
  }

  async deleteMany(
    store: string,
    ids: string[],
    _options?: StorageOptions,
  ): Promise<BatchResult> {
    logger.log(
      `MobileStorageAdapter.deleteMany(${store}, ${ids.length} ids) - stub`,
    );
    this.throwNotImplemented("deleteMany");
  }

  async clear(store: string): Promise<void> {
    logger.log(`MobileStorageAdapter.clear(${store}) - stub`);
    this.throwNotImplemented("clear");
  }

  async exists(store: string, id: string): Promise<boolean> {
    logger.log(`MobileStorageAdapter.exists(${store}, ${id}) - stub`);
    this.throwNotImplemented("exists");
  }

  async count<T extends StorageEntity>(
    store: string,
    _query?: QueryOptions<T>,
  ): Promise<number> {
    logger.log(`MobileStorageAdapter.count(${store}) - stub`);
    this.throwNotImplemented("count");
  }

  // ==================== Querying ====================

  async query<T extends StorageEntity>(
    store: string,
    _query: QueryOptions<T>,
  ): Promise<PaginatedResult<T>> {
    logger.log(`MobileStorageAdapter.query(${store}) - stub`);
    this.throwNotImplemented("query");
  }

  async findOne<T extends StorageEntity>(
    store: string,
    _query: QueryOptions<T>,
  ): Promise<T | null> {
    logger.log(`MobileStorageAdapter.findOne(${store}) - stub`);
    this.throwNotImplemented("findOne");
  }

  // ==================== Transactions ====================

  async beginTransaction(
    stores: string[],
    mode: "readonly" | "readwrite",
  ): Promise<TransactionContext> {
    logger.log(
      `MobileStorageAdapter.beginTransaction(${stores}, ${mode}) - stub`,
    );
    this.throwNotImplemented("beginTransaction");
  }

  async transaction<T>(
    stores: string[],
    mode: "readonly" | "readwrite",
    _operations: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    logger.log(`MobileStorageAdapter.transaction(${stores}, ${mode}) - stub`);
    this.throwNotImplemented("transaction");
  }

  // ==================== Migration ====================

  async getMigrationInfo(): Promise<MigrationInfo> {
    return {
      currentVersion: 0,
      targetVersion: 1,
      needsMigration: false,
      steps: [],
    };
  }

  async migrate(): Promise<void> {
    logger.log("MobileStorageAdapter.migrate() - stub");
    this.throwNotImplemented("migrate");
  }

  // ==================== Import/Export ====================

  async exportData(): Promise<Record<string, StorageEntity[]>> {
    logger.log("MobileStorageAdapter.exportData() - stub");
    this.throwNotImplemented("exportData");
  }

  async importData(
    _data: Record<string, StorageEntity[]>,
    _options?: { overwrite?: boolean },
  ): Promise<BatchResult> {
    logger.log("MobileStorageAdapter.importData() - stub");
    this.throwNotImplemented("importData");
  }

  // ==================== Helper ====================

  private throwNotImplemented(method: string): never {
    throw new Error(
      `MobileStorageAdapter.${method}() is not implemented. ` +
        `This is a stub for future React Native support. ` +
        `Current platform: ${this.config.platform}`,
    );
  }
}

/**
 * iOS-specific storage adapter stub
 */
export class IOSStorageAdapter extends MobileStorageAdapter {
  constructor(config: Partial<Omit<MobileStorageConfig, "platform">> = {}) {
    super({ ...config, platform: "ios" });
  }
}

/**
 * Android-specific storage adapter stub
 */
export class AndroidStorageAdapter extends MobileStorageAdapter {
  constructor(config: Partial<Omit<MobileStorageConfig, "platform">> = {}) {
    super({ ...config, platform: "android" });
  }
}

/**
 * Factory function to create the appropriate mobile adapter
 */
export function createMobileStorageAdapter(
  config?: Partial<MobileStorageConfig>,
): MobileStorageAdapter {
  const platform = config?.platform || detectMobilePlatform();

  switch (platform) {
    case "ios":
      return new IOSStorageAdapter(config);
    case "android":
      return new AndroidStorageAdapter(config);
    default:
      return new MobileStorageAdapter(config);
  }
}

/**
 * Detect mobile platform from environment
 */
function detectMobilePlatform(): MobilePlatform {
  // In React Native, we'd use Platform.OS
  // This is a stub detection
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad")) {
      return "ios";
    }
    if (ua.includes("android")) {
      return "android";
    }
  }
  return "ios"; // Default
}
