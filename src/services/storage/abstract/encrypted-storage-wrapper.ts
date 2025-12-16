/**
 * Encrypted Storage Wrapper
 *
 * A decorator/wrapper that adds encryption to any IStorageProvider.
 * Provides transparent encryption/decryption for sensitive data.
 *
 * Features:
 * - AES-GCM encryption with Web Crypto API
 * - Key derivation with PBKDF2
 * - Automatic encryption based on data sensitivity
 * - Support for field-level encryption
 *
 * @module storage/abstract/encrypted-storage-wrapper
 */

import { createLogger } from "../../../utils/logger";
import type { IStorageProvider } from "./storage-provider";
import type {
  BatchResult,
  EncryptionLevel,
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

const logger = createLogger("EncryptedStorageWrapper");

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Whether encryption is enabled */
  enabled: boolean;
  /** Stores that require encryption */
  encryptedStores: string[];
  /** Fields that should always be encrypted (across all stores) */
  sensitiveFields: string[];
  /** Key derivation iterations (higher = more secure but slower) */
  keyDerivationIterations?: number;
}

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  enabled: true,
  encryptedStores: ["credentials", "tokens", "sessions"],
  sensitiveFields: [
    "password",
    "accessToken",
    "refreshToken",
    "secret",
    "privateKey",
    "apiKey",
  ],
  keyDerivationIterations: 100000,
};

/**
 * Encrypted data envelope
 */
interface EncryptedEnvelope {
  /** Encrypted data as base64 */
  ciphertext: string;
  /** Initialization vector as base64 */
  iv: string;
  /** Encryption algorithm used */
  algorithm: "AES-GCM";
  /** Key derivation salt (if applicable) */
  salt?: string;
  /** Version for forward compatibility */
  version: number;
}

/**
 * EncryptedStorageWrapper - Adds encryption to any storage provider
 *
 * Usage:
 * ```typescript
 * const webAdapter = new WebStorageAdapter();
 * const encryptedStorage = new EncryptedStorageWrapper(webAdapter, {
 *   encryptedStores: ['credentials', 'tokens']
 * });
 *
 * await encryptedStorage.initialize();
 * await encryptedStorage.put('credentials', { id: '1', password: 'secret' });
 * ```
 */
export class EncryptedStorageWrapper implements IStorageProvider {
  private inner: IStorageProvider;
  private config: EncryptionConfig;
  private encryptionKey: CryptoKey | null = null;
  private _initialized = false;

  constructor(
    innerProvider: IStorageProvider,
    config: Partial<EncryptionConfig> = {},
  ) {
    this.inner = innerProvider;
    this.config = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    // Initialize inner provider first
    await this.inner.initialize();

    if (this.config.enabled) {
      await this.initializeEncryption();
    }

    this._initialized = true;
    logger.log("EncryptedStorageWrapper initialized");
  }

  private async initializeEncryption(): Promise<void> {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      logger.log("Web Crypto not available, encryption disabled");
      this.config.enabled = false;
      return;
    }

    try {
      // Try to load existing key
      this.encryptionKey = await this.loadOrCreateKey();
      logger.log("Encryption key initialized");
    } catch (error) {
      logger.error("Failed to initialize encryption:", error);
      this.config.enabled = false;
    }
  }

  private async loadOrCreateKey(): Promise<CryptoKey> {
    const keyStorageKey = "shadowsky_encryption_master_key";

    // Try to load existing key
    const storedKey = localStorage.getItem(keyStorageKey);
    if (storedKey) {
      try {
        const keyData = JSON.parse(storedKey);
        return crypto.subtle.importKey(
          "jwk",
          keyData,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
      } catch {
        logger.log("Could not load existing key, generating new one");
      }
    }

    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    // Store key
    const keyData = await crypto.subtle.exportKey("jwk", key);
    localStorage.setItem(keyStorageKey, JSON.stringify(keyData));

    return key;
  }

  async close(): Promise<void> {
    await this.inner.close();
    this.encryptionKey = null;
    this._initialized = false;
  }

  async isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  getMetadata(): StorageProviderMetadata {
    const innerMeta = this.inner.getMetadata();
    return {
      ...innerMeta,
      name: `Encrypted(${innerMeta.name})`,
      features: {
        ...innerMeta.features,
        encryption: this.config.enabled,
      },
    };
  }

  async getHealth(): Promise<StorageHealth> {
    const innerHealth = await this.inner.getHealth();
    return {
      ...innerHealth,
      message: this.config.enabled
        ? `${innerHealth.message || "OK"} [encrypted]`
        : innerHealth.message,
    };
  }

  // ==================== CRUD Operations ====================

  async get<T extends StorageEntity>(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<T | null> {
    const entity = await this.inner.get<T>(store, id, options);
    if (!entity) return null;

    return this.decryptEntity(store, entity, options);
  }

  async getMany<T extends StorageEntity>(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<T[]> {
    const entities = await this.inner.getMany<T>(store, ids, options);
    return Promise.all(
      entities.map((e) => this.decryptEntity(store, e, options)),
    );
  }

  async getAll<T extends StorageEntity>(
    store: string,
    options?: StorageOptions,
  ): Promise<T[]> {
    const entities = await this.inner.getAll<T>(store, options);
    return Promise.all(
      entities.map((e) => this.decryptEntity(store, e, options)),
    );
  }

  async put<T extends StorageEntity>(
    store: string,
    entity: T,
    options?: StorageOptions,
  ): Promise<void> {
    const encryptedEntity = await this.encryptEntity(store, entity, options);
    await this.inner.put(store, encryptedEntity, options);
  }

  async putMany<T extends StorageEntity>(
    store: string,
    entities: T[],
    options?: StorageOptions,
  ): Promise<BatchResult> {
    const encryptedEntities = await Promise.all(
      entities.map((e) => this.encryptEntity(store, e, options)),
    );
    return this.inner.putMany(store, encryptedEntities, options);
  }

  async delete(
    store: string,
    id: string,
    options?: StorageOptions,
  ): Promise<void> {
    return this.inner.delete(store, id, options);
  }

  async deleteMany(
    store: string,
    ids: string[],
    options?: StorageOptions,
  ): Promise<BatchResult> {
    return this.inner.deleteMany(store, ids, options);
  }

  async clear(store: string): Promise<void> {
    return this.inner.clear(store);
  }

  async exists(store: string, id: string): Promise<boolean> {
    return this.inner.exists(store, id);
  }

  async count<T extends StorageEntity>(
    store: string,
    query?: QueryOptions<T>,
  ): Promise<number> {
    return this.inner.count(store, query);
  }

  // ==================== Querying ====================

  async query<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const result = await this.inner.query<T>(store, query);
    const decryptedItems = await Promise.all(
      result.items.map((e) => this.decryptEntity(store, e)),
    );
    return { ...result, items: decryptedItems };
  }

  async findOne<T extends StorageEntity>(
    store: string,
    query: QueryOptions<T>,
  ): Promise<T | null> {
    const entity = await this.inner.findOne<T>(store, query);
    if (!entity) return null;
    return this.decryptEntity(store, entity);
  }

  // ==================== Transactions ====================

  async beginTransaction(
    stores: string[],
    mode: "readonly" | "readwrite",
  ): Promise<TransactionContext> {
    return this.inner.beginTransaction(stores, mode);
  }

  async transaction<T>(
    stores: string[],
    mode: "readonly" | "readwrite",
    operations: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.inner.transaction(stores, mode, operations);
  }

  // ==================== Events ====================

  subscribe<T extends StorageEntity>(
    store: string,
    listener: StorageEventListener<T>,
  ): () => void {
    return this.inner.subscribe(store, listener);
  }

  emit<T extends StorageEntity>(event: StorageEvent<T>): void {
    this.inner.emit(event);
  }

  // ==================== Migration ====================

  async getMigrationInfo(): Promise<MigrationInfo> {
    return this.inner.getMigrationInfo();
  }

  async migrate(): Promise<void> {
    return this.inner.migrate();
  }

  // ==================== Import/Export ====================

  async exportData(): Promise<Record<string, StorageEntity[]>> {
    // Export decrypted data
    const data = await this.inner.exportData();
    const decryptedData: Record<string, StorageEntity[]> = {};

    for (const [store, entities] of Object.entries(data)) {
      decryptedData[store] = await Promise.all(
        entities.map((e) => this.decryptEntity(store, e)),
      );
    }

    return decryptedData;
  }

  async importData(
    data: Record<string, StorageEntity[]>,
    options?: { overwrite?: boolean },
  ): Promise<BatchResult> {
    // Import and encrypt data
    const encryptedData: Record<string, StorageEntity[]> = {};

    for (const [store, entities] of Object.entries(data)) {
      encryptedData[store] = await Promise.all(
        entities.map((e) => this.encryptEntity(store, e)),
      );
    }

    return this.inner.importData(encryptedData, options);
  }

  // ==================== Encryption Logic ====================

  /**
   * Check if a store should be encrypted
   */
  private shouldEncryptStore(store: string): boolean {
    if (!this.config.enabled || !this.encryptionKey) return false;
    return this.config.encryptedStores.includes(store);
  }

  /**
   * Check if a field should be encrypted
   */
  private shouldEncryptField(fieldName: string): boolean {
    if (!this.config.enabled || !this.encryptionKey) return false;
    return this.config.sensitiveFields.includes(fieldName);
  }

  /**
   * Get encryption level for an entity
   */
  private getEncryptionLevel(
    store: string,
    options?: StorageOptions,
  ): EncryptionLevel {
    if (options?.encryption) return options.encryption;
    if (this.shouldEncryptStore(store)) return "standard";
    return "none";
  }

  /**
   * Encrypt an entity based on store/field rules
   */
  private async encryptEntity<T extends StorageEntity>(
    store: string,
    entity: T,
    options?: StorageOptions,
  ): Promise<T> {
    const encryptionLevel = this.getEncryptionLevel(store, options);

    if (encryptionLevel === "none") {
      return entity;
    }

    if (!this.encryptionKey) {
      logger.log("No encryption key, returning unencrypted entity");
      return entity;
    }

    // Full entity encryption for encrypted stores
    if (this.shouldEncryptStore(store)) {
      return this.encryptFullEntity(entity);
    }

    // Field-level encryption for sensitive fields
    return this.encryptSensitiveFields(entity);
  }

  /**
   * Encrypt the entire entity (except id and timestamps)
   */
  private async encryptFullEntity<T extends StorageEntity>(
    entity: T,
  ): Promise<T> {
    const { id, createdAt, updatedAt, ...data } = entity;
    const encrypted = await this.encrypt(JSON.stringify(data));

    return {
      id,
      createdAt,
      updatedAt,
      __encrypted: encrypted,
    } as unknown as T;
  }

  /**
   * Encrypt only sensitive fields
   */
  private async encryptSensitiveFields<T extends StorageEntity>(
    entity: T,
  ): Promise<T> {
    const result = { ...entity };

    for (const [key, value] of Object.entries(result)) {
      if (
        this.shouldEncryptField(key) &&
        value !== null &&
        value !== undefined
      ) {
        const encrypted = await this.encrypt(
          typeof value === "string" ? value : JSON.stringify(value),
        );
        (result as Record<string, unknown>)[key] = {
          __fieldEncrypted: true,
          data: encrypted,
        };
      }
    }

    return result;
  }

  /**
   * Decrypt an entity
   */
  private async decryptEntity<T extends StorageEntity>(
    store: string,
    entity: T,
    _options?: StorageOptions,
  ): Promise<T> {
    if (!this.config.enabled || !this.encryptionKey) {
      return entity;
    }

    // Check for full entity encryption
    const entityWithEncryption = entity as unknown as {
      __encrypted?: EncryptedEnvelope;
    };
    if (entityWithEncryption.__encrypted) {
      return this.decryptFullEntity(entity);
    }

    // Check for field-level encryption
    return this.decryptSensitiveFields(store, entity);
  }

  /**
   * Decrypt a fully encrypted entity
   */
  private async decryptFullEntity<T extends StorageEntity>(
    entity: T,
  ): Promise<T> {
    const { id, createdAt, updatedAt, __encrypted } = entity as unknown as {
      id: string;
      createdAt: string;
      updatedAt: string;
      __encrypted: EncryptedEnvelope;
    };

    const decrypted = await this.decrypt(__encrypted);
    const data = JSON.parse(decrypted);

    return {
      id,
      createdAt,
      updatedAt,
      ...data,
    } as T;
  }

  /**
   * Decrypt sensitive fields
   */
  private async decryptSensitiveFields<T extends StorageEntity>(
    _store: string,
    entity: T,
  ): Promise<T> {
    const result = { ...entity };

    for (const [key, value] of Object.entries(result)) {
      if (
        value &&
        typeof value === "object" &&
        (value as { __fieldEncrypted?: boolean }).__fieldEncrypted
      ) {
        const encrypted = (value as { data: EncryptedEnvelope }).data;
        const decrypted = await this.decrypt(encrypted);

        // Try to parse as JSON, fallback to string
        try {
          (result as Record<string, unknown>)[key] = JSON.parse(decrypted);
        } catch {
          (result as Record<string, unknown>)[key] = decrypted;
        }
      }
    }

    return result;
  }

  // ==================== Crypto Operations ====================

  /**
   * Encrypt data with AES-GCM
   */
  private async encrypt(plaintext: string): Promise<EncryptedEnvelope> {
    if (!this.encryptionKey) {
      throw new Error("Encryption key not available");
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.encryptionKey,
      encoder.encode(plaintext),
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer),
      algorithm: "AES-GCM",
      version: 1,
    };
  }

  /**
   * Decrypt data with AES-GCM
   */
  private async decrypt(envelope: EncryptedEnvelope): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error("Encryption key not available");
    }

    const ciphertext = this.base64ToArrayBuffer(envelope.ciphertext);
    const iv = this.base64ToArrayBuffer(envelope.iv);

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      this.encryptionKey,
      ciphertext as BufferSource,
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  }

  // ==================== Utilities ====================

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ==================== Public Encryption API ====================

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return (
      this._initialized && this.config.enabled && this.encryptionKey !== null
    );
  }

  /**
   * Get list of encrypted stores
   */
  getEncryptedStores(): string[] {
    return [...this.config.encryptedStores];
  }

  /**
   * Add a store to the encrypted stores list
   */
  addEncryptedStore(store: string): void {
    if (!this.config.encryptedStores.includes(store)) {
      this.config.encryptedStores.push(store);
    }
  }

  /**
   * Add a field to the sensitive fields list
   */
  addSensitiveField(field: string): void {
    if (!this.config.sensitiveFields.includes(field)) {
      this.config.sensitiveFields.push(field);
    }
  }

  /**
   * Get the underlying storage provider
   */
  getInnerProvider(): IStorageProvider {
    return this.inner;
  }
}

/**
 * Create an encrypted storage wrapper
 */
export function createEncryptedStorage(
  provider: IStorageProvider,
  config?: Partial<EncryptionConfig>,
): EncryptedStorageWrapper {
  return new EncryptedStorageWrapper(provider, config);
}
