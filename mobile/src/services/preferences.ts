import { AppBskyActorDefs, BskyAgent } from "@atproto/api";
import { MMKV } from "react-native-mmkv";

import { createLogger } from "../utils/logger";
import { withTimeout } from "../utils/with-timeout";

const logger = createLogger("Preferences");

const AT_PROTO_PREFERENCES_COLLECTION = "com.shadowsky.preferences";
const AT_PROTO_PREFERENCES_RKEY = "self";

/**
 * Keys that sync across devices via AT Proto.
 * These are platform-independent settings that should be consistent
 * whether the user is on web, iOS, or Android.
 */
const SYNCABLE_KEYS: ReadonlySet<keyof AppPreferences> = new Set([
  "theme",
  "showNSFW",
  "contentLanguages",
  "postLanguages",
  "autoPlayVideos",
  "imageQuality",
  "autoGenerateAltText",
  "enableThreadSummaryPreGen",
  "profileVisibility",
  "allowMessages",
  "allowMentions",
  "hideFromSearch",
  "filterContent",
  "defaultPostLanguage",
  "threadNumberingFormat",
  "threadNumberingPosition",
]);

// Device-specific keys that stay local (MMKV only) and are NOT in SYNCABLE_KEYS:
// hapticsEnabled, swipeActionsEnabled, appLockEnabled, backgroundFetchEnabled,
// highContrast, reduceMotion, largeText, screenReaderOptimized

/**
 * The record shape stored in com.shadowsky.preferences on AT Proto.
 * Contains only the syncable subset of AppPreferences plus metadata.
 */
interface SyncablePreferencesRecord {
  $type: "com.shadowsky.preferences";
  version: number;
  updatedAt: string;
  // Syncable preference fields
  mobilePreferences: Partial<AppPreferences>;
}
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

  // Privacy
  profileVisibility: "public" | "followers" | "private";
  allowMessages: "everyone" | "followers" | "none";
  allowMentions: "everyone" | "followers" | "none";
  hideFromSearch: boolean;
  filterContent: boolean;

  // Accessibility
  highContrast: boolean;
  reduceMotion: "system" | "off" | "on";
  largeText: boolean;
  screenReaderOptimized: boolean;

  // Composer Defaults
  defaultPostLanguage: string;
  threadNumberingFormat: "none" | "simple" | "brackets" | "thread" | "dots";
  threadNumberingPosition: "beginning" | "end";
  postDelaySeconds: number;
  enableHashtagSuggestions: boolean;

  // Tab Bar Customization (device-local)
  tabBarItems: string[];
}

const PREFERENCES_KEY = "shadowsky_preferences";

// Default preferences
const DEFAULT_PREFERENCES: AppPreferences = {
  // Appearance
  theme: "dark",

  // Content
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

  // Privacy
  profileVisibility: "public",
  allowMessages: "everyone",
  allowMentions: "everyone",
  hideFromSearch: false,
  filterContent: true,

  // Accessibility
  highContrast: false,
  reduceMotion: "system",
  largeText: false,
  screenReaderOptimized: false,

  // Composer Defaults
  defaultPostLanguage: "en",
  threadNumberingFormat: "none",
  threadNumberingPosition: "beginning",
  postDelaySeconds: 0,
  enableHashtagSuggestions: false,

  // Tab Bar Customization
  tabBarItems: ["home", "search", "feeds", "notifications", "profile"],
};

/**
 * MMKV-backed preferences storage.
 *
 * Migrated from AsyncStorage to MMKV for synchronous reads on the cold start
 * path. MMKV is a C++ key-value store (~30x faster than AsyncStorage) that
 * avoids the JS bridge overhead, making preference loading non-blocking and
 * eliminating an async gap before the first frame.
 */
let _mmkvPreferences: InstanceType<typeof MMKV> | null = null;
function getMMKVPreferences() {
  if (!_mmkvPreferences) {
    _mmkvPreferences = new MMKV({ id: "shadowsky-preferences" });
  }
  return _mmkvPreferences;
}

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
      const stored = getMMKVPreferences().getString(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppPreferences;
        this.cache = { ...DEFAULT_PREFERENCES, ...parsed };
      } else {
        this.cache = DEFAULT_PREFERENCES;
      }
    } catch (error) {
      logger.error("Failed to load preferences from MMKV:", error);
      this.cache = DEFAULT_PREFERENCES;
    }
  }

  /**
   * Migrate preferences from AsyncStorage to MMKV (one-time).
   * Call this early in the app lifecycle. If MMKV already has data this is a no-op.
   */
  async migrateFromAsyncStorage(): Promise<void> {
    // Only migrate if MMKV is empty (first launch after upgrade)
    if (getMMKVPreferences().getString(PREFERENCES_KEY)) {
      return;
    }

    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      const stored = await AsyncStorage.getItem("@shadowsky_preferences");
      if (stored) {
        getMMKVPreferences().set(PREFERENCES_KEY, stored);
        this._loadFromMMKV();
        // Clean up old key after successful migration
        await AsyncStorage.removeItem("@shadowsky_preferences");
      }
    } catch (error) {
      logger.error("Failed to migrate preferences from AsyncStorage:", error);
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
      getMMKVPreferences().set(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      logger.error("Failed to save preference:", error);
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
      getMMKVPreferences().set(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      logger.error("Failed to save preferences:", error);
      throw error;
    }
  }

  /**
   * Reset all preferences to defaults
   */
  async reset(): Promise<void> {
    try {
      getMMKVPreferences().delete(PREFERENCES_KEY);
      this.cache = DEFAULT_PREFERENCES;
    } catch (error) {
      logger.error("Failed to reset preferences:", error);
      throw error;
    }
  }

  /**
   * Clear the cache (useful when switching accounts)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Extract the syncable subset of preferences (cross-platform settings).
   */
  private extractSyncablePrefs(prefs: AppPreferences): Partial<AppPreferences> {
    const syncable: Partial<AppPreferences> = {};
    for (const key of SYNCABLE_KEYS) {
      (syncable as Record<string, unknown>)[key] = prefs[key];
    }
    return syncable;
  }

  /**
   * Push current syncable preferences to AT Proto.
   * Called as a fire-and-forget after local writes.
   */
  async pushToAtProto(agent: BskyAgent): Promise<void> {
    const did = agent.session?.did;
    if (!did) return;

    const current = this.getSync();
    const syncable = this.extractSyncablePrefs(current);

    const record: SyncablePreferencesRecord = {
      $type: AT_PROTO_PREFERENCES_COLLECTION,
      version: 1,
      updatedAt: new Date().toISOString(),
      mobilePreferences: syncable,
    };

    try {
      await withTimeout(() => agent.api.com.atproto.repo.putRecord({
        repo: did,
        collection: AT_PROTO_PREFERENCES_COLLECTION,
        rkey: AT_PROTO_PREFERENCES_RKEY,
        record: record as unknown as Record<string, unknown>,
      }), 30000);
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown>;
      if (errObj?.status === 400) {
        // Record doesn't exist yet, create it
        try {
          await withTimeout(() => agent.api.com.atproto.repo.createRecord({
            repo: did,
            collection: AT_PROTO_PREFERENCES_COLLECTION,
            rkey: AT_PROTO_PREFERENCES_RKEY,
            record: record as unknown as Record<string, unknown>,
          }), 30000);
        } catch (createError) {
          logger.error(
            "Failed to create preferences record on AT Proto:",
            createError,
          );
        }
      } else {
        logger.error("Failed to push preferences to AT Proto:", error);
      }
    }
  }

  /**
   * Fetch preferences from AT Proto and merge with local.
   * Server wins for cross-platform (syncable) settings.
   * Local wins for device-specific settings.
   *
   * Returns the merged preferences, or null if no server data was available.
   */
  async mergeFromAtProto(agent: BskyAgent): Promise<AppPreferences | null> {
    const did = agent.session?.did;
    if (!did) return null;

    let serverPrefs: Partial<AppPreferences> | null = null;

    try {
      const response = await withTimeout(() => agent.api.com.atproto.repo.getRecord({
        repo: did,
        collection: AT_PROTO_PREFERENCES_COLLECTION,
        rkey: AT_PROTO_PREFERENCES_RKEY,
      }), 15000);

      if (response.data.value) {
        const record = response.data
          .value as unknown as SyncablePreferencesRecord;
        if (record.mobilePreferences) {
          serverPrefs = record.mobilePreferences;
        }
      }
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown>;
      // 400 = record doesn't exist yet, which is normal for new users
      if (errObj?.status !== 400) {
        logger.error("Failed to fetch preferences from AT Proto:", error);
      }
      return null;
    }

    if (!serverPrefs) return null;

    // Merge: server wins for syncable keys, local stays for device-specific
    const local = this.getSync();
    const merged = { ...local };

    for (const key of SYNCABLE_KEYS) {
      if (key in serverPrefs) {
        (merged as Record<string, unknown>)[key] = (
          serverPrefs as Record<string, unknown>
        )[key];
      }
    }

    // Persist merged result to MMKV
    getMMKVPreferences().set(PREFERENCES_KEY, JSON.stringify(merged));
    this.cache = merged;

    return merged;
  }

  /**
   * Check whether a preference key should be synced to AT Proto.
   */
  isSyncableKey(key: keyof AppPreferences): boolean {
    return SYNCABLE_KEYS.has(key);
  }

  // ── Muted Words AT Proto Sync ──────────────────────────────────────

  /**
   * Convert a local MutedWord to the AT Proto format used by
   * app.bsky.actor.defs#mutedWord.
   */
  private localToServerMutedWord(
    word: MutedWord,
  ): Pick<
    AppBskyActorDefs.MutedWord,
    "value" | "targets" | "actorTarget" | "expiresAt"
  > {
    const targets: AppBskyActorDefs.MutedWordTarget[] =
      word.appliesTo === "home" ? ["content"] : ["content", "tag"];

    return {
      value: word.value,
      targets,
      actorTarget: "all",
      expiresAt: word.expiresAt
        ? new Date(word.expiresAt).toISOString()
        : undefined,
    };
  }

  /**
   * Convert an AT Proto muted word to our local MutedWord format.
   */
  private serverToLocalMutedWord(item: AppBskyActorDefs.MutedWord): MutedWord {
    const hasTag = (item.targets || []).includes("tag");
    const appliesTo: MutedWord["appliesTo"] = hasTag ? "all" : "home";

    let duration: MutedWord["duration"] = "forever";
    let expiresAt: number | undefined;

    if (item.expiresAt) {
      expiresAt = new Date(item.expiresAt).getTime();
      // Derive approximate duration from remaining time
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        // Already expired — keep the data but mark as expired
        duration = "forever";
      } else if (remaining <= 25 * 60 * 60 * 1000) {
        duration = "24h";
      } else if (remaining <= 8 * 24 * 60 * 60 * 1000) {
        duration = "7d";
      } else {
        duration = "30d";
      }
    }

    return {
      id: item.id || Date.now().toString(),
      value: item.value,
      duration,
      expiresAt,
      appliesTo,
    };
  }

  /**
   * Fetch muted words from the official AT Proto preferences
   * (app.bsky.actor.defs#mutedWordsPref) and merge with local MMKV words.
   *
   * Server words are authoritative. Local-only words (not yet on server)
   * are pushed up. Returns the merged list, or null if fetch failed.
   */
  async syncMutedWordsFromServer(
    agent: BskyAgent,
  ): Promise<MutedWord[] | null> {
    try {
      const response = await withTimeout(() => agent.app.bsky.actor.getPreferences(), 15000);
      const preferences = response.data.preferences;

      const mutedWordsPref = preferences.find(
        (p: unknown) =>
          (p as { $type?: string }).$type ===
          "app.bsky.actor.defs#mutedWordsPref",
      ) as AppBskyActorDefs.MutedWordsPref | undefined;

      const serverWords: MutedWord[] = (mutedWordsPref?.items || []).map(
        (item) => this.serverToLocalMutedWord(item),
      );

      // Get local-only words that aren't on the server yet
      const localWords = this.getSync().mutedWords || [];
      const serverValues = new Set(
        serverWords.map((w) => w.value.toLowerCase()),
      );
      const localOnly = localWords.filter(
        (w) => !serverValues.has(w.value.toLowerCase()),
      );

      // Push any local-only words to the server
      for (const word of localOnly) {
        try {
          await withTimeout(() => agent.addMutedWord(this.localToServerMutedWord(word)), 15000);
        } catch (err) {
          logger.error("Failed to push local muted word to server:", err);
        }
      }

      // Merged list: server words + local-only words
      const merged = [...serverWords, ...localOnly];

      // Persist to MMKV
      await this.set("mutedWords", merged);

      return merged;
    } catch (error) {
      logger.error("Failed to sync muted words from server:", error);
      return null;
    }
  }

  /**
   * Add a muted word to both MMKV and the AT Proto server.
   */
  async addMutedWordWithSync(
    word: MutedWord,
    agent: BskyAgent | null,
  ): Promise<void> {
    // Save locally first (fast)
    const current = this.getSync();
    const updatedWords = [...(current.mutedWords || []), word];
    await this.set("mutedWords", updatedWords);

    // Push to server
    if (agent) {
      try {
        await withTimeout(() => agent.addMutedWord(this.localToServerMutedWord(word)), 15000);
      } catch (error) {
        logger.error("Failed to add muted word to server:", error);
      }
    }
  }

  /**
   * Remove a muted word from both MMKV and the AT Proto server.
   */
  async removeMutedWordWithSync(
    wordId: string,
    agent: BskyAgent | null,
  ): Promise<void> {
    const current = this.getSync();
    const wordToRemove = (current.mutedWords || []).find(
      (w) => w.id === wordId,
    );
    const updatedWords = (current.mutedWords || []).filter(
      (w) => w.id !== wordId,
    );

    // Remove locally first
    await this.set("mutedWords", updatedWords);

    // Remove from server
    if (agent && wordToRemove) {
      try {
        const targets: AppBskyActorDefs.MutedWordTarget[] =
          wordToRemove.appliesTo === "home" ? ["content"] : ["content", "tag"];

        await withTimeout(() => agent.removeMutedWord({
          value: wordToRemove.value,
          targets,
          actorTarget: "all",
        } as AppBskyActorDefs.MutedWord), 15000);
      } catch (error) {
        logger.error("Failed to remove muted word from server:", error);
      }
    }
  }
}

export const preferencesService = new PreferencesService();
