import { BskyAgent } from "@atproto/api";

// Define the app preferences record type
export interface AppPreferencesRecord {
  $type: "app.shadowsky.preferences";
  bookmarkStorageType: "local" | "custom";
  createdAt: string;
  updatedAt: string;
}

const PREFERENCES_RKEY = "self";
const PREFERENCES_COLLECTION = "app.shadowsky.preferences";

export class AppPreferencesService {
  private agent: BskyAgent | null = null;
  private preferencesCache: AppPreferencesRecord | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
    this.preferencesCache = null; // Clear cache when agent changes
  }

  async getPreferences(): Promise<AppPreferencesRecord | null> {
    if (!this.agent) {
      console.log("No agent available, cannot fetch preferences");
      return null;
    }

    // Return cached preferences if available
    if (this.preferencesCache) {
      return this.preferencesCache;
    }

    try {
      const response = await this.agent.com.atproto.repo.getRecord({
        repo: this.agent.session?.did || "",
        collection: PREFERENCES_COLLECTION,
        rkey: PREFERENCES_RKEY,
      });

      this.preferencesCache = response.data
        .value as unknown as AppPreferencesRecord;
      return this.preferencesCache;
    } catch (error: any) {
      if (error?.status === 400 && error?.error === "RecordNotFound") {
        // Record doesn't exist yet, create default preferences
        const defaultPrefs = await this.createDefaultPreferences();
        return defaultPrefs;
      }
      console.error("Failed to fetch app preferences:", error);
      return null;
    }
  }

  async updatePreferences(
    updates: Partial<Omit<AppPreferencesRecord, "$type" | "createdAt">>,
  ): Promise<AppPreferencesRecord | null> {
    if (!this.agent) {
      console.log("No agent available, cannot update preferences");
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

      // Update in PDS
      await this.agent.com.atproto.repo.putRecord({
        repo: this.agent.session?.did || "",
        collection: PREFERENCES_COLLECTION,
        rkey: PREFERENCES_RKEY,
        record: updatedPrefs as unknown as Record<string, unknown>,
      });

      // Update cache
      this.preferencesCache = updatedPrefs;

      return updatedPrefs;
    } catch (error) {
      console.error("Failed to update app preferences:", error);
      return null;
    }
  }

  private async createDefaultPreferences(): Promise<AppPreferencesRecord> {
    const now = new Date().toISOString();

    const defaultPrefs: AppPreferencesRecord = {
      $type: PREFERENCES_COLLECTION,
      bookmarkStorageType: "local", // Default to local storage
      createdAt: now,
      updatedAt: now,
    };

    if (this.agent) {
      try {
        await this.agent.com.atproto.repo.putRecord({
          repo: this.agent.session?.did || "",
          collection: PREFERENCES_COLLECTION,
          rkey: PREFERENCES_RKEY,
          record: defaultPrefs as unknown as Record<string, unknown>,
        });
        this.preferencesCache = defaultPrefs;
      } catch (error) {
        console.error("Failed to create default preferences:", error);
      }
    }

    return defaultPrefs;
  }

  clearCache() {
    this.preferencesCache = null;
  }
}

export const appPreferencesService = new AppPreferencesService();
