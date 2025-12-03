/**
 * Migration Utilities
 *
 * Handles migration of sensitive credentials from insecure localStorage/cookies
 * to secure encrypted storage.
 */

import { debug } from "../../shared/debug";
import { deleteCookie, getCookie } from "../../utils/cookies";
import type { ISecureStorage, MigrationStatus } from "./types";
import { SENSITIVE_STORAGE_KEYS, SecureStorageError } from "./types";

const MIGRATION_KEY = "shadowsky_secure_migration";
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Get current migration status
 */
export function getMigrationStatus(): MigrationStatus | null {
  try {
    const stored = localStorage.getItem(MIGRATION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save migration status
 */
function saveMigrationStatus(status: MigrationStatus): void {
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
}

/**
 * Check if migration is needed
 */
export function isMigrationNeeded(): boolean {
  const status = getMigrationStatus();

  // No migration done yet
  if (!status) {
    // Check if there's anything to migrate
    for (const key of SENSITIVE_STORAGE_KEYS) {
      if (localStorage.getItem(key) || getCookie(key)) {
        return true;
      }
    }
    return false;
  }

  // Check if migration version is current
  if (status.version < CURRENT_MIGRATION_VERSION) {
    return true;
  }

  // Check if there are any keys that weren't migrated
  for (const key of SENSITIVE_STORAGE_KEYS) {
    if (!status.migratedKeys.includes(key)) {
      if (localStorage.getItem(key) || getCookie(key)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Migrate credentials from insecure storage to secure storage
 *
 * @param secureStorage - The secure storage backend to migrate to
 * @param options - Migration options
 * @returns Migration status after completion
 */
export async function migrateToSecureStorage(
  secureStorage: ISecureStorage,
  options: {
    /** Whether to clear insecure storage after successful migration */
    clearInsecure?: boolean;
    /** Callback for progress updates */
    onProgress?: (key: string, success: boolean) => void;
  } = {},
): Promise<MigrationStatus> {
  const { clearInsecure = true, onProgress } = options;

  const status: MigrationStatus = {
    version: CURRENT_MIGRATION_VERSION,
    migratedKeys: [],
    hadErrors: false,
    errors: [],
  };

  // Check if secure storage is available
  const isAvailable = await secureStorage.isAvailable();
  if (!isAvailable) {
    debug.warn("Secure storage not available, skipping migration");
    status.hadErrors = true;
    status.errors = ["Secure storage not available"];
    saveMigrationStatus(status);
    return status;
  }

  for (const key of SENSITIVE_STORAGE_KEYS) {
    try {
      // Try localStorage first
      let value = localStorage.getItem(key);

      // Fall back to cookie
      if (!value) {
        value = getCookie(key);
      }

      if (!value) {
        // Nothing to migrate for this key
        status.migratedKeys.push(key);
        onProgress?.(key, true);
        continue;
      }

      // Validate JSON (we only store JSON data)
      try {
        JSON.parse(value);
      } catch {
        debug.warn(`Skipping migration of ${key}: invalid JSON`);
        status.hadErrors = true;
        status.errors?.push(`Invalid JSON in ${key}`);
        onProgress?.(key, false);
        continue;
      }

      // Store in secure storage
      await secureStorage.setItem(key, value);

      // Verify the migration
      const verifyValue = await secureStorage.getItem(key);
      if (verifyValue !== value) {
        throw new SecureStorageError(
          `Verification failed for ${key}`,
          "ENCRYPTION_FAILED",
        );
      }

      status.migratedKeys.push(key);
      onProgress?.(key, true);

      // Clear insecure storage if requested
      if (clearInsecure) {
        localStorage.removeItem(key);
        deleteCookie(key);
      }

      debug.log(`Migrated ${key} to secure storage`);
    } catch (err) {
      debug.error(`Failed to migrate ${key}:`, err);
      status.hadErrors = true;
      status.errors?.push(
        `Failed to migrate ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
      onProgress?.(key, false);
    }
  }

  status.completedAt = new Date().toISOString();
  saveMigrationStatus(status);

  return status;
}

/**
 * Rollback migration - copy data back from secure storage to insecure storage
 *
 * Use this only in emergencies or for debugging
 */
export async function rollbackMigration(
  secureStorage: ISecureStorage,
): Promise<void> {
  debug.warn("Rolling back secure storage migration");

  for (const key of SENSITIVE_STORAGE_KEYS) {
    try {
      const value = await secureStorage.getItem(key);
      if (value) {
        localStorage.setItem(key, value);
        debug.log(`Rolled back ${key} to localStorage`);
      }
    } catch (err) {
      debug.error(`Failed to rollback ${key}:`, err);
    }
  }

  // Clear migration status
  localStorage.removeItem(MIGRATION_KEY);
}

/**
 * Clear all insecure storage of sensitive keys
 *
 * Only call this after confirming migration was successful
 */
export function clearInsecureStorage(): void {
  for (const key of SENSITIVE_STORAGE_KEYS) {
    localStorage.removeItem(key);
    deleteCookie(key);
  }
  debug.log("Cleared insecure storage of sensitive keys");
}

/**
 * Get a value from the appropriate storage based on migration status
 *
 * During migration transition period, this checks secure storage first,
 * then falls back to insecure storage.
 */
export async function getSecureOrFallback(
  secureStorage: ISecureStorage,
  key: string,
): Promise<string | null> {
  // Try secure storage first
  try {
    const isAvailable = await secureStorage.isAvailable();
    if (isAvailable) {
      const value = await secureStorage.getItem(key);
      if (value) return value;
    }
  } catch (err) {
    debug.warn(`Failed to read from secure storage:`, err);
  }

  // Fall back to localStorage
  const localValue = localStorage.getItem(key);
  if (localValue) return localValue;

  // Fall back to cookie
  return getCookie(key);
}

/**
 * Set a value in both secure and insecure storage during transition
 *
 * This ensures backward compatibility during the migration period
 */
export async function setSecureWithFallback(
  secureStorage: ISecureStorage,
  key: string,
  value: string,
): Promise<void> {
  // Always set in insecure storage for backward compatibility
  localStorage.setItem(key, value);

  // Also set in secure storage if available
  try {
    const isAvailable = await secureStorage.isAvailable();
    if (isAvailable) {
      await secureStorage.setItem(key, value);
    }
  } catch (err) {
    debug.warn(`Failed to write to secure storage:`, err);
  }
}
