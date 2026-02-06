/**
 * Web Crypto Storage Backend
 *
 * Secure storage implementation using Web Crypto API for encryption
 * and IndexedDB for persistent storage.
 *
 * Security Model:
 * - Uses AES-GCM encryption for data at rest
 * - Encryption key is derived from a device-specific secret using PBKDF2
 * - Data is stored in IndexedDB, not localStorage (more resistant to XSS)
 * - Each item has a unique IV for encryption
 */

import { debug } from "../../shared/debug";
import { isIndexedDBAvailable, isWebCryptoAvailable } from "./platform";
import type { ISecureStorage, SecureStorageOptions } from "./types";
import { SecureStorageError } from "./types";

const DB_NAME = "shadowsky_secure_storage";
const DB_VERSION = 1;
const STORE_NAME = "credentials";
const KEY_STORE_NAME = "encryption_keys";

interface StoredItem {
  key: string;
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  options: SecureStorageOptions;
  createdAt: number;
  updatedAt: number;
}

/**
 * Web Crypto-based secure storage implementation
 */
export class WebCryptoStorage implements ISecureStorage {
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the storage backend
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!isWebCryptoAvailable()) {
      throw new SecureStorageError(
        "Web Crypto API is not available",
        "NOT_AVAILABLE",
      );
    }

    if (!isIndexedDBAvailable()) {
      throw new SecureStorageError(
        "IndexedDB is not available",
        "NOT_AVAILABLE",
      );
    }

    // Open IndexedDB
    this.db = await this.openDatabase();

    // Get or create encryption key
    this.encryptionKey = await this.getOrCreateEncryptionKey();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(
          new SecureStorageError(
            "Failed to open secure storage database",
            "NOT_AVAILABLE",
            request.error ?? undefined,
          ),
        );
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create credentials store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }

        // Create key store for encryption keys
        if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
          db.createObjectStore(KEY_STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Get or create the encryption key
   *
   * The key is stored in IndexedDB wrapped with a device-specific key.
   * This provides:
   * 1. Persistence across sessions
   * 2. A layer of indirection for the actual encryption key
   */
  private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    const db = this.db!;

    // Try to load existing key
    const existingKey = await new Promise<CryptoKey | null>(
      (resolve, reject) => {
        const tx = db.transaction(KEY_STORE_NAME, "readonly");
        const store = tx.objectStore(KEY_STORE_NAME);
        const request = store.get("master_key");

        request.onsuccess = async () => {
          if (request.result?.wrappedKey) {
            try {
              // Import the stored key
              const key = await this.unwrapStoredKey(
                request.result.wrappedKey,
                request.result.salt,
              );
              resolve(key);
            } catch (err) {
              // If unwrapping fails, we'll create a new key
              debug.warn("Failed to unwrap stored key, creating new one:", err);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      },
    );

    if (existingKey) {
      return existingKey;
    }

    // Generate a new encryption key
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true, // extractable for wrapping
      ["encrypt", "decrypt"],
    );

    // Store the key wrapped with a device-derived key
    await this.storeEncryptionKey(key);

    return key;
  }

  /**
   * Derive a key from device-specific data for wrapping the master key
   */
  private async deriveDeviceKey(salt: Uint8Array): Promise<CryptoKey> {
    // Use a combination of domain and user agent as device identifier
    // This isn't perfect security, but adds a layer of device binding
    const deviceId = `${window.location.origin}|${navigator.userAgent}`;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(deviceId),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-KW", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    );
  }

  /**
   * Store the encryption key wrapped with device key
   */
  private async storeEncryptionKey(key: CryptoKey): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const deviceKey = await this.deriveDeviceKey(salt);

    // Wrap the master key
    const wrappedKey = await crypto.subtle.wrapKey("raw", key, deviceKey, {
      name: "AES-KW",
    });

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, "readwrite");
      const store = tx.objectStore(KEY_STORE_NAME);
      const request = store.put({
        id: "master_key",
        wrappedKey: new Uint8Array(wrappedKey),
        salt: salt,
        createdAt: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Unwrap a stored key using the device key
   */
  private async unwrapStoredKey(
    wrappedKey: Uint8Array,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    const deviceKey = await this.deriveDeviceKey(salt);

    return crypto.subtle.unwrapKey(
      "raw",
      wrappedKey.buffer as ArrayBuffer,
      deviceKey,
      { name: "AES-KW" },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt data using the master key
   */
  private async encrypt(
    data: string,
  ): Promise<{ data: ArrayBuffer; iv: Uint8Array }> {
    await this.ensureInitialized();

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    try {
      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        this.encryptionKey!,
        encoder.encode(data),
      );

      return { data: encryptedData, iv };
    } catch (err) {
      throw new SecureStorageError(
        "Failed to encrypt data",
        "ENCRYPTION_FAILED",
        err instanceof Error ? err : undefined,
      );
    }
  }

  /**
   * Decrypt data using the master key
   */
  private async decrypt(
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        this.encryptionKey!,
        encryptedData,
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (err) {
      throw new SecureStorageError(
        "Failed to decrypt data",
        "DECRYPTION_FAILED",
        err instanceof Error ? err : undefined,
      );
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db || !this.encryptionKey) {
      await this.initialize();
    }
  }

  async setItem(
    key: string,
    value: string,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    await this.ensureInitialized();

    const { data: encryptedData, iv } = await this.encrypt(value);
    const now = Date.now();

    const item: StoredItem = {
      key,
      encryptedData,
      iv,
      options,
      createdAt: now,
      updatedAt: now,
    };

    // Check if item exists to preserve createdAt
    const existing = await this.getStoredItem(key);
    if (existing) {
      item.createdAt = existing.createdAt;
    }

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getItem(key: string): Promise<string | null> {
    await this.ensureInitialized();

    const item = await this.getStoredItem(key);
    if (!item) {
      return null;
    }

    try {
      return await this.decrypt(item.encryptedData, item.iv);
    } catch (err) {
      // If decryption fails, the data may be corrupted
      debug.error(`Failed to decrypt item ${key}:`, err);
      return null;
    }
  }

  private async getStoredItem(key: string): Promise<StoredItem | null> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.ensureInitialized();

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async hasItem(key: string): Promise<boolean> {
    await this.ensureInitialized();

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.count(key);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<string[]> {
    await this.ensureInitialized();

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  async setBiometricProtection(key: string, enabled: boolean): Promise<void> {
    // Web doesn't have true biometric protection for storage
    // This is a placeholder for future native implementations
    const item = await this.getStoredItem(key);
    if (!item) {
      throw new SecureStorageError(`Key not found: ${key}`, "KEY_NOT_FOUND");
    }

    // Update options
    item.options.biometricProtection = enabled;
    item.updatedAt = Date.now();

    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async isBiometricAvailable(): Promise<boolean> {
    // Check if WebAuthn with platform authenticator is available
    if (typeof window === "undefined") return false;

    try {
      if (typeof window.PublicKeyCredential === "undefined") return false;

      if (
        typeof window.PublicKeyCredential
          .isUserVerifyingPlatformAuthenticatorAvailable === "function"
      ) {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }

      return false;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return isWebCryptoAvailable() && isIndexedDBAvailable();
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.encryptionKey = null;
      this.initPromise = null;
    }
  }
}
