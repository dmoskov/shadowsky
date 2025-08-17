import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";

// Define the app preferences stored in AT Protocol preferences API
export interface ShadowSkyPreferences {
  $type: "com.shadowsky.prefs";
  bookmarkStorageType: "local" | "custom";
  columnStorageType: "local" | "atproto";
  appSettingsVersion: number;
  createdAt: string;
  updatedAt: string;
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
  }>;
  version: number;
}

// Legacy interface for compatibility
export interface AppPreferencesRecord {
  $type: "app.shadowsky.preferences";
  bookmarkStorageType: "local" | "custom";
  columnStorageType: "local" | "custom";
  draftStorageType: "local" | "custom";
  createdAt: string;
  updatedAt: string;
}

const PREFERENCES_KEY = "com.shadowsky.prefs";
const COLUMNS_KEY = "com.shadowsky.columns";
const logger = createLogger("AppPreferencesService");

export class AppPreferencesService {
  private agent: BskyAgent | null = null;
  private preferencesCache: AppPreferencesRecord | null = null;
  private readonly LOCALSTORAGE_KEY = "shadowsky_app_preferences";

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
    this.preferencesCache = null; // Clear cache when agent changes
  }

  async getPreferences(): Promise<AppPreferencesRecord | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot fetch preferences");
      return null;
    }

    // Return cached preferences if available
    if (this.preferencesCache) {
      return this.preferencesCache;
    }

    try {
      // Try to get preferences from AT Protocol preferences API
      const response = await this.agent.api.app.bsky.actor.getPreferences();

      // Look for our preferences in the response
      const shadowSkyPref = response.data.preferences.find(
        (pref: any) => pref.$type === PREFERENCES_KEY,
      ) as ShadowSkyPreferences | undefined;

      if (shadowSkyPref) {
        // Convert from new format to legacy format
        const prefs: AppPreferencesRecord = {
          $type: "app.shadowsky.preferences",
          bookmarkStorageType: shadowSkyPref.bookmarkStorageType,
          columnStorageType:
            shadowSkyPref.columnStorageType === "atproto" ? "custom" : "local",
          draftStorageType: "local", // Always local
          createdAt: shadowSkyPref.createdAt,
          updatedAt: shadowSkyPref.updatedAt,
        };
        this.preferencesCache = prefs;
        return prefs;
      }
    } catch (error) {
      logger.log("Failed to fetch preferences from AT Protocol:", error);
    }

    // Try to load from localStorage as fallback
    const localPrefs = this.loadFromLocalStorage();
    if (localPrefs) {
      this.preferencesCache = localPrefs;
      // Migrate to AT Protocol preferences
      await this.migrateToAtProtoPrefs(localPrefs);
      return localPrefs;
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

      // Save to AT Protocol preferences API
      const shadowSkyPref: ShadowSkyPreferences = {
        $type: PREFERENCES_KEY,
        bookmarkStorageType: updatedPrefs.bookmarkStorageType,
        columnStorageType:
          updatedPrefs.columnStorageType === "custom" ? "atproto" : "local",
        appSettingsVersion: 1,
        createdAt: updatedPrefs.createdAt,
        updatedAt: updatedPrefs.updatedAt,
      };

      try {
        // Get current preferences from API
        const response = await this.agent.api.app.bsky.actor.getPreferences();

        // Filter out our preference type and add the updated one
        const otherPrefs = response.data.preferences.filter(
          (pref: any) => pref.$type !== PREFERENCES_KEY,
        );

        // Update preferences
        await this.agent.api.app.bsky.actor.putPreferences({
          preferences: [...otherPrefs, shadowSkyPref],
        });

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
      bookmarkStorageType: "local", // Default to local storage
      columnStorageType: "local", // Default to local storage
      draftStorageType: "local", // Always local storage
      createdAt: now,
      updatedAt: now,
    };

    // Try to save to AT Protocol
    if (this.agent) {
      await this.updatePreferences({
        bookmarkStorageType: defaultPrefs.bookmarkStorageType,
        columnStorageType: defaultPrefs.columnStorageType,
      });
    } else {
      // Save to localStorage
      this.saveToLocalStorage(defaultPrefs);
    }

    this.preferencesCache = defaultPrefs;
    return defaultPrefs;
  }

  private async migrateToAtProtoPrefs(
    localPrefs: AppPreferencesRecord,
  ): Promise<void> {
    if (!this.agent) return;

    try {
      await this.updatePreferences({
        bookmarkStorageType: localPrefs.bookmarkStorageType,
        columnStorageType: localPrefs.columnStorageType,
      });
      logger.log("Successfully migrated preferences to AT Protocol");
    } catch (error) {
      logger.error("Failed to migrate preferences to AT Protocol:", error);
    }
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

  clearCache() {
    this.preferencesCache = null;
  }

  // Column data methods
  async getColumns(): Promise<ShadowSkyColumns | null> {
    if (!this.agent) {
      logger.log("No agent available, cannot fetch columns");
      return null;
    }

    try {
      const response = await this.agent.api.app.bsky.actor.getPreferences();

      const columnsPref = response.data.preferences.find(
        (pref: any) => pref.$type === COLUMNS_KEY,
      ) as ShadowSkyColumns | undefined;

      if (columnsPref) {
        return columnsPref;
      }
    } catch (error) {
      logger.log("Failed to fetch columns from AT Protocol:", error);
    }

    // Return default empty columns
    return {
      $type: COLUMNS_KEY,
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
        $type: COLUMNS_KEY,
        columns: columns,
        version: 1,
      };

      // Get current preferences from API
      const response = await this.agent.api.app.bsky.actor.getPreferences();

      // Filter out our columns preference type and add the updated one
      const otherPrefs = response.data.preferences.filter(
        (pref: any) => pref.$type !== COLUMNS_KEY,
      );

      // Update preferences
      await this.agent.api.app.bsky.actor.putPreferences({
        preferences: [...otherPrefs, columnsPref],
      });

      logger.log("Successfully saved columns to AT Protocol preferences");
      return true;
    } catch (error) {
      logger.error("Failed to save columns to AT Protocol:", error);
      return false;
    }
  }
}

export const appPreferencesService = new AppPreferencesService();
