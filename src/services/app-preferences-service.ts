import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { withAtProtoRetry } from "../utils/storage-retry";
import { AT_PROTO_COLLECTIONS } from "./storage/storage-constants";

// Define the app preferences stored as custom record
export interface ShadowSkyPreferences {
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
}

// Column data stored in preferences
export interface ShadowSkyColumns {
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
export interface ShadowSkyBookmarks {
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
export interface ShadowSkyDrafts {
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
      // Try to get preferences from AT Protocol custom record with retry
      const response = await withAtProtoRetry(async () => {
        return this.agent!.api.com.atproto.repo.getRecord({
          repo: this.agent!.session?.did || "",
          collection: PREFERENCES_COLLECTION,
          rkey: PREFERENCES_RKEY,
        });
      }, "getPreferences");

      if (response.data.value) {
        const shadowSkyPref = response.data
          .value as unknown as ShadowSkyPreferences;
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
        };
        // Mark that we loaded from AT Protocol
        (prefs as any).isStoredInAtProto = true;
        logger.log("Converted preferences:", prefs);
        this.preferencesCache = prefs;
        return prefs;
      }
    } catch (error: any) {
      // 400 error means record doesn't exist yet, which is normal
      if (error?.status !== 400) {
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
      };
      // Mark that we loaded from localStorage
      (validatedPrefs as any).isStoredInAtProto = false;
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

      // Clear cache immediately to ensure fresh data on next read
      this.preferencesCache = null;

      // Save to AT Protocol as custom record
      // Save to AT Protocol as custom record
      const shadowSkyPref: ShadowSkyPreferences = {
        $type: PREFERENCES_COLLECTION,
        columnStorageType: updatedPrefs.columnStorageType || "local",
        draftStorageType: updatedPrefs.draftStorageType || "local",
        appSettingsVersion: 1,
        createdAt: updatedPrefs.createdAt || new Date().toISOString(),
        updatedAt: updatedPrefs.updatedAt || new Date().toISOString(),
        version: 1,
        aiSettings: updatedPrefs.aiSettings,
        columnWidth: updatedPrefs.columnWidth,
      };

      logger.log("Saving to AT Protocol:", shadowSkyPref);

      try {
        const did = this.agent.session?.did;
        if (!did) throw new Error("No DID available");

        // Try to update existing record
        try {
          await this.agent.api.com.atproto.repo.putRecord({
            repo: did,
            collection: PREFERENCES_COLLECTION,
            rkey: PREFERENCES_RKEY,
            record: shadowSkyPref as any,
          });
        } catch (putError: any) {
          // If record doesn't exist, create it
          if (putError?.status === 400) {
            await this.agent.api.com.atproto.repo.createRecord({
              repo: did,
              collection: PREFERENCES_COLLECTION,
              rkey: PREFERENCES_RKEY,
              record: shadowSkyPref as any,
            });
          } else {
            throw putError;
          }
        }

        logger.log("Successfully saved preferences to AT Protocol");
      } catch (atProtoError) {
        logger.error(
          "Failed to save preferences to AT Protocol:",
          atProtoError,
        );
        // Fall back to localStorage
        this.saveToLocalStorage(updatedPrefs);
      }

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
      try {
        const shadowSkyPref: ShadowSkyPreferences = {
          $type: AT_PROTO_COLLECTIONS.PREFERENCES,
          columnStorageType: defaultPrefs.columnStorageType,
          draftStorageType: defaultPrefs.draftStorageType,
          createdAt: defaultPrefs.createdAt,
          updatedAt: defaultPrefs.updatedAt,
          version: 1,
        };

        await this.agent.api.com.atproto.repo.createRecord({
          repo: this.agent.session?.did || "",
          collection: PREFERENCES_COLLECTION,
          rkey: PREFERENCES_RKEY,
          record: shadowSkyPref as any,
        });

        (defaultPrefs as any).isStoredInAtProto = true;
        logger.log("Created default preferences in AT Protocol");
      } catch (error) {
        logger.log(
          "Failed to create preferences in AT Protocol, saving to localStorage:",
          error,
        );
        this.saveToLocalStorage(defaultPrefs);
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
  async getColumns(): Promise<ShadowSkyColumns | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot fetch columns");
      return null;
    }

    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did || "",
        collection: COLUMNS_COLLECTION,
        rkey: COLUMNS_RKEY,
      });

      if (response.data.value) {
        return response.data.value as unknown as ShadowSkyColumns;
      }
    } catch (error: any) {
      // 400 error means record doesn't exist yet
      if (error?.status !== 400) {
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

  async updateColumns(columns: ShadowSkyColumns["columns"]): Promise<boolean> {
    if (!this.agent) {
      logger.log("No agent available, cannot update columns");
      return false;
    }

    try {
      const columnsPref: ShadowSkyColumns = {
        $type: COLUMNS_COLLECTION,
        columns: columns,
        version: 1,
      };

      const did = this.agent.session?.did;
      if (!did) throw new Error("No DID available");

      // Try to update existing record
      try {
        await this.agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection: COLUMNS_COLLECTION,
          rkey: COLUMNS_RKEY,
          record: columnsPref as any,
        });
      } catch (putError: any) {
        // If record doesn't exist, create it
        if (putError?.status === 400) {
          await this.agent.api.com.atproto.repo.createRecord({
            repo: did,
            collection: COLUMNS_COLLECTION,
            rkey: COLUMNS_RKEY,
            record: columnsPref as any,
          });
        } else {
          throw putError;
        }
      }

      logger.log("Successfully saved columns to AT Protocol");
      return true;
    } catch (error) {
      logger.error("Failed to save columns to AT Protocol:", error);
      return false;
    }
  }
}

export const appPreferencesService = new AppPreferencesService();
