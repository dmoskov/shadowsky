/**
 * Storage constants to ensure consistency across the application.
 * IMPORTANT: Use these constants instead of hardcoding strings to prevent key mismatches.
 */

// Storage type preference keys (ALWAYS SINGULAR - NO 'S')
export const STORAGE_PREF_KEYS = {
  BOOKMARK: "bookmarkStorageType",
  COLUMN: "columnStorageType",
  DRAFT: "draftStorageType",
} as const;

// LocalStorage keys
export const LOCAL_STORAGE_KEYS = {
  // Current standardized keys
  COLUMNS: "shadowsky_columns",
  PREFERENCES: "shadowsky_app_preferences",

  // Legacy keys (for backward compatibility)
  COLUMNS_LEGACY: "skyDeckColumns",
  DRAFTS_LEGACY: "bsky_thread_drafts",

  // Bookmark keys use a prefix pattern
  BOOKMARK_PREFIX: "shadowsky-bookmarks-",

  // Migration tracking
  COLUMNS_MIGRATED: "shadowsky_columns_migrated",
  COLUMN_MIGRATION_NOTICE_SHOWN: "shadowsky_column_migration_notice_shown",
} as const;

// AT Protocol collections
export const AT_PROTO_COLLECTIONS = {
  PREFERENCES: "com.shadowsky.preferences",
  COLUMNS: "com.shadowsky.columns",
  BOOKMARKS: "com.shadowsky.bookmarks", // Changed to plural for singleton
  DRAFTS: "com.shadowsky.drafts", // Changed to plural for singleton
  LIST: "com.shadowsky.list", // Individual list records
} as const;

// AT Protocol record keys (for singleton records)
export const AT_PROTO_RKEYS = {
  PREFERENCES: "self",
  COLUMNS: "self",
  BOOKMARKS: "self",
  DRAFTS: "self",
} as const;

// Storage type values
export const STORAGE_TYPES = {
  LOCAL: "local",
  CUSTOM: "custom", // Custom AT Protocol records (our own types)
  ATPROTO: "atproto", // Only used for columns in AT Protocol
  OFFICIAL: "official", // Official Bluesky bookmarks API
} as const;

// Helper to get the correct preference key for a data type
export function getStoragePrefKey(
  dataType: "bookmark" | "column" | "draft",
): string {
  switch (dataType) {
    case "bookmark":
      return STORAGE_PREF_KEYS.BOOKMARK;
    case "column":
      return STORAGE_PREF_KEYS.COLUMN;
    case "draft":
      return STORAGE_PREF_KEYS.DRAFT;
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}

// Helper to scope storage keys by account DID
export function getScopedStorageKey(baseKey: string, did?: string): string {
  if (!did) return baseKey;
  return `${baseKey}_${did}`;
}

// Type definitions for type safety
export type StorageType = (typeof STORAGE_TYPES)[keyof typeof STORAGE_TYPES];
export type DataType = "bookmark" | "column" | "draft" | "settings";
export type StoragePrefKey =
  (typeof STORAGE_PREF_KEYS)[keyof typeof STORAGE_PREF_KEYS];
