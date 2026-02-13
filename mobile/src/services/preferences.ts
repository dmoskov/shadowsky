import AsyncStorage from "@react-native-async-storage/async-storage";

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

  // Data
  autoPlayVideos: "always" | "wifi" | "never";
  imageQuality: "high" | "medium" | "low";

  // Background fetch
  backgroundFetchEnabled: boolean;

  // Haptics
  hapticsEnabled: boolean;
}

const PREFERENCES_KEY = "@shadowsky_preferences";

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

  // Data
  autoPlayVideos: "wifi",
  imageQuality: "high",

  // Background fetch
  backgroundFetchEnabled: true,

  // Haptics
  hapticsEnabled: true,
};

class PreferencesService {
  private cache: AppPreferences | null = null;

  /**
   * Get all preferences
   */
  async get(): Promise<AppPreferences> {
    // Return cached preferences if available
    if (this.cache) {
      return this.cache;
    }

    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppPreferences;
        this.cache = { ...DEFAULT_PREFERENCES, ...parsed };
        return this.cache;
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }

    // Return default preferences
    this.cache = DEFAULT_PREFERENCES;
    return DEFAULT_PREFERENCES;
  }

  /**
   * Update a single preference
   */
  async set(key: keyof AppPreferences, value: unknown): Promise<void> {
    try {
      const current = await this.get();
      const updated = { ...current, [key]: value };
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      console.error("Failed to save preference:", error);
      throw error;
    }
  }

  /**
   * Update multiple preferences at once
   */
  async setMultiple(updates: Partial<AppPreferences>): Promise<void> {
    try {
      const current = await this.get();
      const updated = { ...current, ...updates };
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      this.cache = updated;
    } catch (error) {
      console.error("Failed to save preferences:", error);
      throw error;
    }
  }

  /**
   * Reset all preferences to defaults
   */
  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFERENCES_KEY);
      this.cache = DEFAULT_PREFERENCES;
    } catch (error) {
      console.error("Failed to reset preferences:", error);
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
