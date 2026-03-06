import { useRouter } from "expo-router";
import React from "react";
import { Switch, Text, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function AIFeaturesSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const styles = createSectionStyles(themeColors);

  if (!preferences) return null;

  const switchColors = {
    trackColor: {
      false: themeColors.borderLight,
      true: themeColors.primary,
    },
    thumbColor: themeColors.text,
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AI FEATURES</Text>

      <SettingRow
        label="AI Thread Summaries"
        description="Show AI-generated summaries at the top of long threads"
      >
        <Switch
          value={preferences.enableAISummaries}
          onValueChange={(value) =>
            updatePreference("enableAISummaries", value)
          }
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>

      <SettingRow
        label="Auto-Generate Alt Text"
        description="Automatically generate descriptive alt text when you attach images"
      >
        <Switch
          value={preferences.autoGenerateAltText}
          onValueChange={(value) =>
            updatePreference("autoGenerateAltText", value)
          }
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>

      <SettingRow
        label="Pre-Generate Thread Summaries"
        description="Cache summaries for bookmarked threads for faster loading"
      >
        <Switch
          value={preferences.enableThreadSummaryPreGen}
          onValueChange={(value) =>
            updatePreference("enableThreadSummaryPreGen", value)
          }
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>

      <SettingRow
        label="Add Missing Alt Text"
        description="Review your posts and add alt text to images that don't have it"
        onPress={() => router.push("/(app)/settings/alt-text-backfill" as any)}
        showChevron
      />
    </View>
  );
}
