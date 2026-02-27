import React from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function ContentSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const styles = createSectionStyles(themeColors);

  if (!preferences) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CONTENT</Text>

      <SettingRow label="Default Feed">
        <View style={styles.themeSelector}>
          {(["following", "discover"] as const).map((feed) => (
            <TouchableOpacity
              key={feed}
              style={[
                styles.themeButton,
                preferences.defaultFeed === feed && styles.themeButtonActive,
              ]}
              onPress={() => updatePreference("defaultFeed", feed)}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  preferences.defaultFeed === feed &&
                    styles.themeButtonTextActive,
                ]}
              >
                {feed.charAt(0).toUpperCase() + feed.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SettingRow>

      <SettingRow
        label="Show NSFW Content"
        description="Display posts marked as sensitive"
      >
        <Switch
          value={preferences.showNSFW}
          onValueChange={(value) => updatePreference("showNSFW", value)}
          trackColor={{
            false: themeColors.borderLight,
            true: themeColors.primary,
          }}
          thumbColor={themeColors.text}
        />
      </SettingRow>
    </View>
  );
}
