/**
 * Abstract Storage Module
 *
 * Cross-platform storage abstraction for web and mobile persistence.
 *
 * @module storage/abstract
 *
 * @example
 * ```typescript
 * import {
 *   getStorageProvider,
 *   createEncryptedStorage,
 *   WebStorageAdapter,
 *   MobileStorageAdapter
 * } from './services/storage/abstract';
 *
 * // Get platform-appropriate storage
 * const storage = await getStorageProvider();
 * await storage.initialize();
 *
 * // Use with encryption for sensitive data
 * const encryptedStorage = createEncryptedStorage(storage, {
 *   encryptedStores: ['credentials', 'tokens']
 * });
 *
 * // Store data
 * await encryptedStorage.put('credentials', {
 *   id: 'user-1',
 *   accessToken: 'secret-token',
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString()
 * });
 *
 * // Query data
 * const result = await encryptedStorage.query('credentials', {
 *   filters: [{ field: 'id', operator: 'eq', value: 'user-1' }]
 * });
 * ```
 */

// Types
export type {
  BatchResult,
  EncryptionLevel,
  MigrationInfo,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
  StorageEntity,
  StorageEvent,
  StorageEventListener,
  StorageEventType,
  StorageHealth,
  StorageOptions,
  StorageProviderFeatures,
  StorageProviderMetadata,
  StorageStatus,
  TransactionContext,
} from "./types";

// Core interfaces and base class
export { BaseStorageProvider } from "./storage-provider";
export type { IStorageProvider } from "./storage-provider";

// Web implementation
export {
  getWebStorageAdapter,
  resetWebStorageAdapter,
  WebStorageAdapter,
} from "./web-storage-adapter";

// Mobile implementation (stubbed)
export {
  AndroidStorageAdapter,
  createMobileStorageAdapter,
  IOSStorageAdapter,
  MobileStorageAdapter,
} from "./mobile-storage-adapter";
export type {
  MobilePlatform,
  MobileStorageConfig,
} from "./mobile-storage-adapter";

// Encryption layer
export {
  createEncryptedStorage,
  EncryptedStorageWrapper,
} from "./encrypted-storage-wrapper";
export type { EncryptionConfig } from "./encrypted-storage-wrapper";

// ==================== Factory Functions ====================

import {
  EncryptedStorageWrapper,
  type EncryptionConfig,
} from "./encrypted-storage-wrapper";
import { createMobileStorageAdapter } from "./mobile-storage-adapter";
import type { IStorageProvider } from "./storage-provider";
import { WebStorageAdapter } from "./web-storage-adapter";

/**
 * Detect the current platform
 */
export function detectPlatform(): "web" | "ios" | "android" {
  // Check for React Native
  // @ts-expect-error - React Native global
  if (typeof global !== "undefined" && global.__DEV__ !== undefined) {
    // React Native environment
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent?.toLowerCase() || "";
      if (ua.includes("iphone") || ua.includes("ipad")) {
        return "ios";
      }
      if (ua.includes("android")) {
        return "android";
      }
    }
    return "ios"; // Default mobile
  }

  return "web";
}

/**
 * Storage provider options
 */
export interface StorageProviderOptions {
  /** Override platform detection */
  platform?: "web" | "ios" | "android";
  /** Enable encryption */
  encryption?: boolean;
  /** Encryption configuration */
  encryptionConfig?: Partial<EncryptionConfig>;
}

/**
 * Get a storage provider appropriate for the current platform
 *
 * @param options - Configuration options
 * @returns Storage provider instance
 *
 * @example
 * ```typescript
 * // Auto-detect platform
 * const storage = await getStorageProvider();
 *
 * // Force web storage
 * const webStorage = await getStorageProvider({ platform: 'web' });
 *
 * // With encryption
 * const secureStorage = await getStorageProvider({
 *   encryption: true,
 *   encryptionConfig: { encryptedStores: ['credentials'] }
 * });
 * ```
 */
export async function getStorageProvider(
  options: StorageProviderOptions = {},
): Promise<IStorageProvider> {
  const platform = options.platform || detectPlatform();

  let provider: IStorageProvider;

  switch (platform) {
    case "ios":
    case "android":
      provider = createMobileStorageAdapter({ platform });
      break;
    case "web":
    default:
      provider = new WebStorageAdapter();
      break;
  }

  // Wrap with encryption if requested
  if (options.encryption) {
    provider = new EncryptedStorageWrapper(provider, options.encryptionConfig);
  }

  return provider;
}

/**
 * Create and initialize a storage provider
 *
 * Convenience function that creates and initializes in one call.
 */
export async function createStorageProvider(
  options: StorageProviderOptions = {},
): Promise<IStorageProvider> {
  const provider = await getStorageProvider(options);
  await provider.initialize();
  return provider;
}
