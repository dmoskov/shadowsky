/**
 * Secure Storage Types
 *
 * Platform-agnostic interface for secure credential storage.
 * Implementations include:
 * - Web: Web Crypto API with IndexedDB
 * - iOS: Keychain Services (future)
 * - Android: EncryptedSharedPreferences (future)
 */

/**
 * Options for storing items securely
 */
export interface SecureStorageOptions {
  /**
   * Require biometric authentication to access this item.
   * Only available on platforms with biometric support (iOS, Android).
   */
  biometricProtection?: boolean;

  /**
   * How long the item can be accessed after authentication (in seconds).
   * Default: 0 (no timeout, requires auth each time)
   */
  accessTimeout?: number;

  /**
   * Allow access only when device is unlocked.
   * Default: true
   */
  requireUnlock?: boolean;
}

/**
 * Secure storage backend interface
 */
export interface ISecureStorage {
  /**
   * Store a value securely
   * @param key - Unique identifier for the value
   * @param value - String value to store (typically JSON)
   * @param options - Security options
   */
  setItem(
    key: string,
    value: string,
    options?: SecureStorageOptions,
  ): Promise<void>;

  /**
   * Retrieve a securely stored value
   * @param key - Unique identifier for the value
   * @returns The stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Remove a securely stored value
   * @param key - Unique identifier for the value
   */
  removeItem(key: string): Promise<void>;

  /**
   * Check if a key exists in secure storage
   * @param key - Unique identifier to check
   */
  hasItem(key: string): Promise<boolean>;

  /**
   * Clear all items from secure storage
   * Use with caution - this removes all stored credentials
   */
  clear(): Promise<void>;

  /**
   * Get all keys in secure storage
   */
  getAllKeys(): Promise<string[]>;

  /**
   * Enable or disable biometric protection for a specific key
   * @param key - Key to modify
   * @param enabled - Whether biometric protection is enabled
   */
  setBiometricProtection(key: string, enabled: boolean): Promise<void>;

  /**
   * Check if biometric protection is available on this platform
   */
  isBiometricAvailable(): Promise<boolean>;

  /**
   * Check if secure storage is available on this platform
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Platform detection types
 */
export type Platform = "web" | "ios" | "android";

/**
 * Secure storage error types
 */
export class SecureStorageError extends Error {
  constructor(
    message: string,
    public readonly code: SecureStorageErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "SecureStorageError";
  }
}

export type SecureStorageErrorCode =
  | "NOT_AVAILABLE" // Secure storage not available on platform
  | "ENCRYPTION_FAILED" // Failed to encrypt data
  | "DECRYPTION_FAILED" // Failed to decrypt data
  | "KEY_NOT_FOUND" // Key does not exist
  | "BIOMETRIC_NOT_AVAILABLE" // Biometrics not available
  | "BIOMETRIC_FAILED" // Biometric authentication failed
  | "STORAGE_FULL" // Storage quota exceeded
  | "PERMISSION_DENIED" // Permission denied
  | "UNKNOWN"; // Unknown error

/**
 * Migration status for tracking credential migration
 */
export interface MigrationStatus {
  version: number;
  migratedKeys: string[];
  completedAt?: string;
  hadErrors: boolean;
  errors?: string[];
}

/**
 * Storage keys that contain sensitive data and should be migrated
 */
export const SENSITIVE_STORAGE_KEYS = [
  "bsky_accounts",
  "bsky_active_account",
  "notifications_bsky_session",
] as const;

export type SensitiveStorageKey = (typeof SENSITIVE_STORAGE_KEYS)[number];
