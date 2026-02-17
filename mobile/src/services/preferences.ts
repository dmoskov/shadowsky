import { MMKV } from "react-native-mmkv";

import { createLogger } from '../utils/logger';

const logger = createLogger('Preferences');
export interface MutedWord {
  id: string;
  value: string;
  duration?: "forever" | "24h" | "7d" | "30d";
  expiresAt?: number;
  appliesTo?: "all" | "home";
}

export interface AppPreferences {
  // Appearance
  theme: "dark" | "light" | "system";

  // Content
  defaultFeed: "following" | "discover";
  showNSFW: boolean;
  contentLanguages: string[];

  // Notifications
  notificationsEnabled: boolean;
  notifyOnLikes: boolean;
  notifyOnReplies: boolean;
  notifyOnFollows: boolean;
  notifyOnMentions: boolean;
  notifyOnQuotes: boolean;

  // Interaction
  hapticsEnabled: boolean;
  swipeActionsEnabled: boolean;

  // Data
  autoPlayVideos: "always" | "wifi" | "never";
  imageQuality: "high" | "medium" | "low";

  // Background fetch
  backgroundFetchEnabled: boolean;

  // Security
  appLockEnabled: boolean;

  // Moderation
  mutedWords: MutedWord[];

  // Compose
  postLanguages: string[];

  // AI Features
  autoGenerateAltText: boolean;
  enableThreadSummaryPreGen: boolean;
}

const PREFERENCES_KEY = "shadowsky_preferences";

// Default preferences
const DEFAULT_PREFERENCES: AppPreferences = {
  // Appearance
  theme: "dark",

  // Content
  defaultFeed: "following",
  showNSFW: false,
  contentLanguages: ["en"],

  // Notifications
  notificationsEnabled: true,
  notifyOnLikes: true,
  notifyOnReplies: true,
  notifyOnFollows: true,
  notifyOnMentions: true,
  notifyOnQuotes: true,

  // Interaction
  hapticsEnabled: true,
  swipeActionsEnabled: true,

  // Data
  autoPlayVideos: "wifi",
  imageQuality: "high",

  // Background fetch
  backgroundFetchEnabled: true,

  // Security
  appLockEnabled: false,

  // Moderation
  mutedWords: [],

  // Compose
  postLanguages: ["en"],

  // AI Features
  autoGenerateAltText: false,
  enableThreadSummaryPreGen: true,
};

/**
 * MMKV-backed preferences storage.
 *
 * Migrated from AsyncStorage to MMKV for synchronous reads on the cold start
 * path. MMKV is a C++ key-value store (~30x faster than AsyncStorage) that
 * avoids the JS bridge overhead, making preference loading non-blocking and
 * eliminating an async gap before the first frame.
 */
const mmkvPreferences = new MMKV({ id: 'shadowsky-preferences' });

class PreferencesService {
  private cache: AppPreferences | null = null;

  constructor() {
    // Attempt one-time migration from AsyncStorage (@ prefixed key) to MMKV.
    // This runs synchronously on first access; if there is no MMKV value yet
    // but AsyncStorage had data, the PreferencesContext will call migrateFromAsyncStorage().
    this._loadFromMMKV();
  }

  /**
   * Synchronously load preferences from MMKV into cache.
   */
  private _loadFromMMKV(): void {
    try {
      const stored = mmkvPreferences.getString(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppPreferences;
        this.cache = { ...DEFAULT_PREFERENCES, ...parsed };
      } else {
        this.cache = DEFAULT_PREFERENCES;
      }
    } catch (error) {
      logger.error('Failed to load preferences from MMKV:', error);
      this.cache = DEFAULT_PREFERENCES;
    }
  }

  /**
   * Migrate preferences from AsyncStorage to MMKV (one-time).
   * Call this early in the app lifecycle. If MMKV already has data this is a no-op.
   */
  async migrateFromAsyncStorage(): Promise<void> {
    // Only migrate if MMKV is empty (first launch after upgrade)
    if (mmkvPreferences.getString(PREFERENCES_KEY)) {
      return;
    }

    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const stored = await AsyncStorage.getItem('@shadowsky_preferences');
      if (stored) {
        mmkvPreferences.set(PREFERENCES_KEY, stored);
        this._loadFromMMKV();
        // Clean up old key after successful migration
        await AsyncStorage.removeItem('@shadowsky_preferences');
      }
    } catch (error) {
      logger.error('Failed to migrate preferences from AsyncStorage:', error);
    }
  }

  /**
   * Get all preferences (synchronous — returns cached MMKV data).
   * The async signature is preserved for backward compatibility with callers.
   */
  async get(): Promise<AppPreferences> {
    if (this.cache) {
      return this.cache;
    }
    this._loadFromMMKV();
    return this.cache!;
  }

  /**
   * Get preferences synchronously (no await needed).
   * Preferred on the cold start path to avoid async gaps.
   */
  getSync(): AppPreferences {
    if (this.cache) {
      return this.cache;
    }
    this._loadFromMMKV();
    return this.cache!;
  }

  /**
   * Update a single preference
   */
  async set(key: keyof AppPreferences, value: unknown): Promise<void> {
    try {
      const current = this.getSync();
      const updated = { ...current, [key]: value };
      mmkvPreferences.set(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      logger.error('Failed to save preference:', error);
      throw error;
    }
  }

  /**
   * Update multiple preferences at once
   */
  async setMultiple(updates: Partial<AppPreferences>): Promise<void> {
    try {
      const current = this.getSync();
      const updated = { ...current, ...updates };
      mmkvPreferences.set(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      logger.error('Failed to save preferences:', error);
      throw error;
    }
  }

  /**
   * Reset all preferences to defaults
   */
  async reset(): Promise<void> {
    try {
      mmkvPreferences.delete(PREFERENCES_KEY);
      this.cache = DEFAULT_PREFERENCES;
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      throw error;
    }
  }

  /**
   * Clear the cache (useful when switching accounts)
   */
  clearCache(): void {
    this.cache = null;
  }
}

export const preferencesService = new PreferencesService();
