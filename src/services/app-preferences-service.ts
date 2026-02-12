import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { withAtProtoRetry } from "../utils/storage-retry";
import { AT_PROTO_COLLECTIONS } from "./storage/storage-constants";

// Background refresh settings
export interface BackgroundRefreshSettings {
  /** Enable/disable background refresh entirely */
  enabled: boolean;
  /** Refresh frequency preference */
  frequency: "high" | "normal" | "low";
  /** Which content types to refresh */
  contentTypes: {
    timeline: boolean;
    notifications: boolean;
    directMessages: boolean;
  };
  /** Battery/data saving mode */
  dataSaverMode: boolean;
  /** Only sync on WiFi */
  wifiOnly: boolean;
}

// Multi-account posting settings
export interface MultiAccountPostingSettings {
  /** Default accounts to post to (DIDs) */
  defaultPostingAccounts: string[];
  /** Show confirmation dialog before posting to multiple accounts */
  showConfirmationDialog: boolean;
}

// Define the app preferences stored as custom record
export interface AsphodelPreferences {
  $type: "com.shadowsky.preferences";
  columnStorageType: "local" | "atproto";
  draftStorageType: "local" | "custom";
  appSettingsVersion?: number;
  createdAt: string;
  updatedAt: string;
  version: number;
  // AI composer settings
  aiSettings?: {
    autoGenerateAltText: boolean;
    enableHashtagSuggestions: boolean;
  };
  // Column display settings
  columnWidth?: number;
  // Background refresh settings
  backgroundRefresh?: BackgroundRefreshSettings;
  // Multi-account posting settings
  multiAccountPosting?: MultiAccountPostingSettings;
}

// Column data stored in preferences
export interface AsphodelColumns {
  $type: "com.shadowsky.columns";
  columns: Array<{
    id: string;
    type: string; // Stored as string in preferences
    title?: string;
    data?: string;
    createdAt: string;
    updatedAt: string;
    // Feed preferences for feed-type columns
    selectedFeedUri?: string;
  }>;
  version: number;
}

// Bookmark data stored as singleton
export interface AsphodelBookmarks {
  $type: "com.shadowsky.bookmarks";
  bookmarks: Array<{
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    text: string;
    createdAt: string;
    bookmarkedAt: string;
  }>;
  version: number;
}

// Draft data stored as singleton
export interface AsphodelDrafts {
  $type: "com.shadowsky.drafts";
  drafts: Array<{
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
    replyTo?: {
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
      };
    };
    quote?: {
      uri: string;
      cid: string;
    };
    images?: Array<{
      alt: string;
      data?: string; // base64
      url?: string;
    }>;
  }>;
  version: number;
}

// Internal interface
export interface AppPreferencesRecord {
  $type: "app.shadowsky.preferences";
  columnStorageType: "local" | "atproto";
  draftStorageType: "local" | "custom";
  createdAt: string;
  updatedAt: string;
  // Track if preferences are stored in AT Protocol
  isStoredInAtProto?: boolean;
  // AI composer settings
  aiSettings?: {
    autoGenerateAltText: boolean;
    enableHashtagSuggestions: boolean;
  };
  // Column display settings
  columnWidth?: number;
  // Background refresh settings
  backgroundRefresh?: BackgroundRefreshSettings;
  // Multi-account posting settings
  multiAccountPosting?: MultiAccountPostingSettings;
}

const PREFERENCES_COLLECTION = "com.shadowsky.preferences";
const PREFERENCES_RKEY = "self";
const COLUMNS_COLLECTION = "com.shadowsky.columns";
const COLUMNS_RKEY = "self";
const logger = createLogger("AppPreferencesService");

export class AppPreferencesService {
  private agent: BskyAgent | null = null;
  private preferencesCache: AppPreferencesRecord | null = null;
  private readonly LOCALSTORAGE_KEY = "shadowsky_app_preferences";

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
    this.preferencesCache = null; // Clear cache when agent changes
  }

  clearCache() {
    this.preferencesCache = null;
  }

  async getPreferences(): Promise<AppPreferencesRecord | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot fetch preferences");
      return null;
    }

    // Return cached preferences if available
    if (this.preferencesCache) {
      logger.log("Returning cached preferences:", this.preferencesCache);
      return this.preferencesCache;
    }

    try {
      // Ensure we have a valid DID before making the request
      const did = this.agent.session?.did;
      if (!did) {
        logger.log(
          "No DID available in agent session, falling back to localStorage",
        );
        // Skip AT Protocol fetch and fall through to localStorage
        throw { status: 400 }; // Trigger fallback path
      }

      // Try to get preferences from AT Protocol custom record with retry
      const response = await withAtProtoRetry(async () => {
        return this.agent!.api.com.atproto.repo.getRecord({
          repo: did,
          collection: PREFERENCES_COLLECTION,
          rkey: PREFERENCES_RKEY,
        });
      }, "getPreferences");

      if (response.data.value) {
        const shadowSkyPref = response.data
          .value as unknown as AsphodelPreferences;
        logger.log("Loaded from AT Protocol:", shadowSkyPref);
        // Convert from stored format
        const prefs: AppPreferencesRecord = {
          $type: "app.shadowsky.preferences",
          columnStorageType: shadowSkyPref.columnStorageType || "local",
          draftStorageType: shadowSkyPref.draftStorageType || "local",
          createdAt: shadowSkyPref.createdAt,
          updatedAt: shadowSkyPref.updatedAt,
          aiSettings: shadowSkyPref.aiSettings,
          columnWidth: shadowSkyPref.columnWidth,
          backgroundRefresh: shadowSkyPref.backgroundRefresh,
          multiAccountPosting: shadowSkyPref.multiAccountPosting,
        };
        // Mark that we loaded from AT Protocol
        prefs.isStoredInAtProto = true;
        logger.log("Converted preferences:", prefs);
        this.preferencesCache = prefs;
        return prefs;
      }
    } catch (error: unknown) {
      // 400 error means record doesn't exist yet, which is normal
      const errObj = error as Record<string, unknown>;
      if (errObj?.status !== 400) {
        logger.log("Failed to fetch preferences from AT Protocol:", error);
      }
    }

    // Try to load from localStorage as fallback
    const localPrefs = this.loadFromLocalStorage();
    if (localPrefs) {
      // Ensure all required fields are present
      const validatedPrefs: AppPreferencesRecord = {
        $type: "app.shadowsky.preferences",
        columnStorageType: localPrefs.columnStorageType || "local",
        draftStorageType: localPrefs.draftStorageType || "local",
        createdAt: localPrefs.createdAt || new Date().toISOString(),
        updatedAt: localPrefs.updatedAt || new Date().toISOString(),
        aiSettings: localPrefs.aiSettings,
        columnWidth: localPrefs.columnWidth,
        backgroundRefresh: localPrefs.backgroundRefresh,
        multiAccountPosting: localPrefs.multiAccountPosting,
      };
      // Mark that we loaded from localStorage
      validatedPrefs.isStoredInAtProto = false;
      this.preferencesCache = validatedPrefs;
      // Don't migrate automatically - wait for user action
      return validatedPrefs;
    }

    // Create default preferences
    const defaultPrefs = await this.createDefaultPreferences();
    return defaultPrefs;
  }

  async updatePreferences(
    updates: Partial<Omit<AppPreferencesRecord, "$type" | "createdAt">>,
  ): Promise<AppPreferencesRecord | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot update preferences");
      return null;
    }

    try {
      // Get current preferences or create new ones
      let currentPrefs = await this.getPreferences();
      if (!currentPrefs) {
        currentPrefs = await this.createDefaultPreferences();
      }

      // Merge updates
      const updatedPrefs: AppPreferencesRecord = {
        ...currentPrefs,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      logger.log("Updating preferences:", {
        currentPrefs,
        updates,
        updatedPrefs,
      });

      // Save to AT Protocol as custom record
      const shadowSkyPref: AsphodelPreferences = {
        $type: PREFERENCES_COLLECTION,
        columnStorageType: updatedPrefs.columnStorageType || "local",
        draftStorageType: updatedPrefs.draftStorageType || "local",
        appSettingsVersion: 1,
        createdAt: updatedPrefs.createdAt || new Date().toISOString(),
        updatedAt: updatedPrefs.updatedAt || new Date().toISOString(),
        version: 1,
        aiSettings: updatedPrefs.aiSettings,
        columnWidth: updatedPrefs.columnWidth,
        backgroundRefresh: updatedPrefs.backgroundRefresh,
        multiAccountPosting: updatedPrefs.multiAccountPosting,
      };

      logger.log("Saving to AT Protocol:", shadowSkyPref);

      let atProtoSaveSucceeded = false;
      try {
        const did = this.agent.session?.did;
        if (!did) throw new Error("No DID available");

        // Try to update existing record with retry
        await withAtProtoRetry(async () => {
          try {
            await this.agent!.api.com.atproto.repo.putRecord({
              repo: did,
              collection: PREFERENCES_COLLECTION,
              rkey: PREFERENCES_RKEY,
              record: shadowSkyPref as unknown as Record<string, unknown>,
            });
          } catch (putError: unknown) {
            // If record doesn't exist, create it
            const putErrObj = putError as Record<string, unknown>;
            if (putErrObj?.status === 400) {
              await this.agent!.api.com.atproto.repo.createRecord({
                repo: did,
                collection: PREFERENCES_COLLECTION,
                rkey: PREFERENCES_RKEY,
                record: shadowSkyPref as unknown as Record<string, unknown>,
              });
            } else {
              throw putError;
            }
          }
        }, "updatePreferences");

        atProtoSaveSucceeded = true;
        logger.log("Successfully saved preferences to AT Protocol");
      } catch (atProtoError) {
        logger.error(
          "Failed to save preferences to AT Protocol:",
          atProtoError,
        );
        // Fall back to localStorage
        this.saveToLocalStorage(updatedPrefs);
      }

      // Set storage flag based on actual save result
      updatedPrefs.isStoredInAtProto = atProtoSaveSucceeded;

      // Update cache
      this.preferencesCache = updatedPrefs;

      // Also save to localStorage as backup
      this.saveToLocalStorage(updatedPrefs);

      return updatedPrefs;
    } catch (error) {
      logger.error("Failed to update app preferences:", error);
      return null;
    }
  }

  private async createDefaultPreferences(): Promise<AppPreferencesRecord> {
    const now = new Date().toISOString();

    const defaultPrefs: AppPreferencesRecord = {
      $type: "app.shadowsky.preferences",
      columnStorageType: "local", // Default to local storage
      draftStorageType: "local", // Always local storage
      createdAt: now,
      updatedAt: now,
      isStoredInAtProto: false,
      aiSettings: {
        autoGenerateAltText: false,
        enableHashtagSuggestions: false,
      },
    };

    // Try to save to AT Protocol
    if (this.agent) {
      const did = this.agent.session?.did;
      if (!did) {
        logger.log(
          "No DID available, saving default preferences to localStorage",
        );
        this.saveToLocalStorage(defaultPrefs);
      } else {
        try {
          const shadowSkyPref: AsphodelPreferences = {
            $type: AT_PROTO_COLLECTIONS.PREFERENCES,
            columnStorageType: defaultPrefs.columnStorageType,
            draftStorageType: defaultPrefs.draftStorageType,
            createdAt: defaultPrefs.createdAt,
            updatedAt: defaultPrefs.updatedAt,
            version: 1,
          };

          await withAtProtoRetry(async () => {
            await this.agent!.api.com.atproto.repo.createRecord({
              repo: did,
              collection: PREFERENCES_COLLECTION,
              rkey: PREFERENCES_RKEY,
              record: shadowSkyPref as unknown as Record<string, unknown>,
            });
          }, "createDefaultPreferences");

          defaultPrefs.isStoredInAtProto = true;
          logger.log("Created default preferences in AT Protocol");
        } catch (error) {
          logger.log(
            "Failed to create preferences in AT Protocol, saving to localStorage:",
            error,
          );
          this.saveToLocalStorage(defaultPrefs);
        }
      }
    } else {
      // Save to localStorage
      this.saveToLocalStorage(defaultPrefs);
    }

    this.preferencesCache = defaultPrefs;
    return defaultPrefs;
  }

  private loadFromLocalStorage(): AppPreferencesRecord | null {
    try {
      const stored = localStorage.getItem(this.LOCALSTORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AppPreferencesRecord;
      }
    } catch (error) {
      logger.error("Failed to load preferences from localStorage:", error);
    }
    return null;
  }

  private saveToLocalStorage(prefs: AppPreferencesRecord): void {
    try {
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      logger.error("Failed to save preferences to localStorage:", error);
    }
  }

  // Column data methods
  async getColumns(): Promise<AsphodelColumns | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot fetch columns");
      return null;
    }

    const did = this.agent.session?.did;
    if (!did) {
      logger.log("No DID available, returning default empty columns");
      return {
        $type: COLUMNS_COLLECTION,
        columns: [],
        version: 1,
      };
    }

    try {
      const response = await withAtProtoRetry(async () => {
        return this.agent!.api.com.atproto.repo.getRecord({
          repo: did,
          collection: COLUMNS_COLLECTION,
          rkey: COLUMNS_RKEY,
        });
      }, "getColumns");

      if (response.data.value) {
        return response.data.value as unknown as AsphodelColumns;
      }
    } catch (error: unknown) {
      // 400 error means record doesn't exist yet
      const errObj = error as Record<string, unknown>;
      if (errObj?.status !== 400) {
        logger.log("Failed to fetch columns from AT Protocol:", error);
      }
    }

    // Return default empty columns
    return {
      $type: COLUMNS_COLLECTION,
      columns: [],
      version: 1,
    };
  }

  async updateColumns(columns: AsphodelColumns["columns"]): Promise<boolean> {
    if (!this.agent) {
      logger.log("No agent available, cannot update columns");
      return false;
    }

    try {
      const columnsPref: AsphodelColumns = {
        $type: COLUMNS_COLLECTION,
        columns: columns,
        version: 1,
      };

      const did = this.agent.session?.did;
      if (!did) throw new Error("No DID available");

      // Try to update existing record with retry
      await withAtProtoRetry(async () => {
        try {
          await this.agent!.api.com.atproto.repo.putRecord({
            repo: did,
            collection: COLUMNS_COLLECTION,
            rkey: COLUMNS_RKEY,
            record: columnsPref as unknown as Record<string, unknown>,
          });
        } catch (putError: unknown) {
          // If record doesn't exist, create it
          const putErrObj = putError as Record<string, unknown>;
          if (putErrObj?.status === 400) {
            await this.agent!.api.com.atproto.repo.createRecord({
              repo: did,
              collection: COLUMNS_COLLECTION,
              rkey: COLUMNS_RKEY,
              record: columnsPref as unknown as Record<string, unknown>,
            });
          } else {
            throw putError;
          }
        }
      }, "updateColumns");

      logger.log("Successfully saved columns to AT Protocol");
      return true;
    } catch (error) {
      logger.error("Failed to save columns to AT Protocol:", error);
      return false;
    }
  }
}

export const appPreferencesService = new AppPreferencesService();
