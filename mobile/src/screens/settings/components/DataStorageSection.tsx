import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Switch, Text, TouchableOpacity, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  registerBackgroundFetch,
  unregisterBackgroundFetch,
} from "../../../services/background-fetch";
import { createLogger } from "../../../utils/logger";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

const logger = createLogger("DataStorageSection");

export function DataStorageSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const sectionStyles = createSectionStyles(themeColors);
  const [cacheSize, setCacheSize] = useState<string>("calculating...");

  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      if (totalSize < 1024) {
        setCacheSize(`${totalSize} B`);
      } else if (totalSize < 1024 * 1024) {
        setCacheSize(`${(totalSize / 1024).toFixed(2)} KB`);
      } else {
        setCacheSize(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (error) {
      logger.error("Failed to calculate cache size:", error);
      setCacheSize("unknown");
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data including posts, profiles, and images. Your settings and bookmarks will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              queryClient.clear();
              await calculateCacheSize();
              Alert.alert("Success", "Cache cleared successfully");
            } catch {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const handleClearSearchHistory = () => {
    Alert.alert(
      "Clear Search History",
      "This will delete all your search history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("@shadowsky_search_history");
              Alert.alert("Success", "Search history cleared");
            } catch {
              Alert.alert("Error", "Failed to clear search history");
            }
          },
        },
      ],
    );
  };

  const handleClearBookmarks = () => {
    Alert.alert(
      "Clear Bookmarks",
      "This will delete all your bookmarks. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("shadowsky_bookmarks");
              Alert.alert("Success", "Bookmarks cleared");
            } catch {
              Alert.alert("Error", "Failed to clear bookmarks");
            }
          },
        },
      ],
    );
  };

  if (!preferences) return null;

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>DATA & STORAGE</Text>

      <SettingRow
        label="Data Export & Import"
        description="Export your data or import from a backup"
        onPress={() => router.push("/(app)/settings/data-export")}
        showChevron
      />

      <SettingRow
        label="Media Cache"
        description="Manage cached media files"
        onPress={() => router.push("/(app)/settings/media-cache")}
        showChevron
      />

      <SettingRow
        label="Performance"
        description="Optimize data usage and app performance"
        onPress={() => router.push("/(app)/settings/performance")}
        showChevron
      />

      <SettingRow
        label="Background Fetch"
        description="Pre-load fresh content when app is closed"
      >
        <Switch
          value={preferences.backgroundFetchEnabled}
          onValueChange={async (value) => {
            await updatePreference("backgroundFetchEnabled", value);
            if (value) {
              await registerBackgroundFetch();
            } else {
              await unregisterBackgroundFetch();
            }
          }}
          trackColor={{
            false: themeColors.borderLight,
            true: themeColors.primary,
          }}
          thumbColor={themeColors.text}
        />
      </SettingRow>

      <SettingRow label="Auto-play Videos">
        <View style={sectionStyles.themeSelector}>
          {(["always", "wifi", "never"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                sectionStyles.themeButton,
                sectionStyles.smallButton,
                preferences.autoPlayVideos === option &&
                  sectionStyles.themeButtonActive,
              ]}
              onPress={() => updatePreference("autoPlayVideos", option)}
            >
              <Text
                style={[
                  sectionStyles.themeButtonText,
                  sectionStyles.smallButtonText,
                  preferences.autoPlayVideos === option &&
                    sectionStyles.themeButtonTextActive,
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SettingRow>

      <SettingRow label="Image Quality">
        <View style={sectionStyles.themeSelector}>
          {(["high", "medium", "low"] as const).map((quality) => (
            <TouchableOpacity
              key={quality}
              style={[
                sectionStyles.themeButton,
                sectionStyles.smallButton,
                preferences.imageQuality === quality &&
                  sectionStyles.themeButtonActive,
              ]}
              onPress={() => updatePreference("imageQuality", quality)}
            >
              <Text
                style={[
                  sectionStyles.themeButtonText,
                  sectionStyles.smallButtonText,
                  preferences.imageQuality === quality &&
                    sectionStyles.themeButtonTextActive,
                ]}
              >
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SettingRow>

      <SettingRow
        label="Cache Size"
        description={cacheSize}
        onPress={handleClearCache}
        showChevron
      />

      <SettingRow
        label="Clear Search History"
        onPress={handleClearSearchHistory}
        showChevron
      />

      <SettingRow
        label="Clear Bookmarks"
        onPress={handleClearBookmarks}
        labelStyle={sectionStyles.dangerText}
        showChevron
      />
    </View>
  );
}
