/**
 * Secure Storage Module
 *
 * Platform-agnostic secure credential storage for authentication tokens
 * and sensitive user data.
 *
 * Usage:
 * ```typescript
 * import { getSecureStorage, secureStorage } from './services/secure-storage';
 *
 * // Use the singleton instance
 * await secureStorage.setItem('auth_token', token);
 * const token = await secureStorage.getItem('auth_token');
 *
 * // Or create a new instance
 * const storage = await getSecureStorage();
 * ```
 */

import { debug } from "../../shared/debug";
import { AndroidKeystoreStorage } from "./android-keystore-storage";
import { IOSKeychainStorage } from "./ios-keychain-storage";
import { detectPlatform, getPlatformCapabilities } from "./platform";
import type { ISecureStorage } from "./types";
import { WebCryptoStorage } from "./web-crypto-storage";

// Re-export types
export { SecureStorageError, SENSITIVE_STORAGE_KEYS } from "./types";
export type {
  ISecureStorage,
  MigrationStatus,
  Platform,
  SecureStorageOptions,
} from "./types";

// Re-export platform utilities
export { detectPlatform, getPlatformCapabilities } from "./platform";

// Re-export migration utilities
export {
  clearInsecureStorage,
  getMigrationStatus,
  getSecureOrFallback,
  isMigrationNeeded,
  migrateToSecureStorage,
  rollbackMigration,
  setSecureWithFallback,
} from "./migration";

// Re-export backend classes for testing
export { AndroidKeystoreStorage } from "./android-keystore-storage";
export { IOSKeychainStorage } from "./ios-keychain-storage";
export { WebCryptoStorage } from "./web-crypto-storage";

/**
 * Create a secure storage instance for the current platform
 */
export async function createSecureStorage(): Promise<ISecureStorage> {
  const platform = detectPlatform();
  const capabilities = await getPlatformCapabilities();

  debug.log("Creating secure storage for platform:", platform, capabilities);

  let storage: ISecureStorage;

  switch (platform) {
    case "ios":
      storage = new IOSKeychainStorage();
      break;
    case "android":
      storage = new AndroidKeystoreStorage();
      break;
    case "web":
    default:
      storage = new WebCryptoStorage();
      break;
  }

  // Verify availability
  const isAvailable = await storage.isAvailable();
  if (!isAvailable) {
    debug.warn(
      `Secure storage not available for platform ${platform}, falling back to web storage`,
    );

    // Always fall back to web crypto storage if platform-specific storage isn't available
    if (platform !== "web") {
      storage = new WebCryptoStorage();
    }
  }

  // Initialize web crypto storage
  if (storage instanceof WebCryptoStorage) {
    await storage.initialize();
  }

  return storage;
}

/**
 * Singleton secure storage instance
 */
let singletonStorage: ISecureStorage | null = null;
let singletonPromise: Promise<ISecureStorage> | null = null;

/**
 * Get the singleton secure storage instance
 *
 * This is the recommended way to access secure storage in most cases.
 */
export async function getSecureStorage(): Promise<ISecureStorage> {
  if (singletonStorage) {
    return singletonStorage;
  }

  if (singletonPromise) {
    return singletonPromise;
  }

  singletonPromise = createSecureStorage();
  singletonStorage = await singletonPromise;
  singletonPromise = null;

  return singletonStorage;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSecureStorage(): void {
  if (singletonStorage instanceof WebCryptoStorage) {
    singletonStorage.close();
  }
  singletonStorage = null;
  singletonPromise = null;
}

/**
 * Proxy object that lazily initializes secure storage
 *
 * This provides a synchronous API that internally manages async initialization.
 * Useful for gradual migration from localStorage.
 */
export const secureStorage = {
  async setItem(
    key: string,
    value: string,
    options?: { biometricProtection?: boolean },
  ): Promise<void> {
    const storage = await getSecureStorage();
    return storage.setItem(key, value, options);
  },

  async getItem(key: string): Promise<string | null> {
    const storage = await getSecureStorage();
    return storage.getItem(key);
  },

  async removeItem(key: string): Promise<void> {
    const storage = await getSecureStorage();
    return storage.removeItem(key);
  },

  async hasItem(key: string): Promise<boolean> {
    const storage = await getSecureStorage();
    return storage.hasItem(key);
  },

  async clear(): Promise<void> {
    const storage = await getSecureStorage();
    return storage.clear();
  },

  async getAllKeys(): Promise<string[]> {
    const storage = await getSecureStorage();
    return storage.getAllKeys();
  },

  async setBiometricProtection(key: string, enabled: boolean): Promise<void> {
    const storage = await getSecureStorage();
    return storage.setBiometricProtection(key, enabled);
  },

  async isBiometricAvailable(): Promise<boolean> {
    const storage = await getSecureStorage();
    return storage.isBiometricAvailable();
  },

  async isAvailable(): Promise<boolean> {
    try {
      const storage = await getSecureStorage();
      return storage.isAvailable();
    } catch {
      return false;
    }
  },
};
