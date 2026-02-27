import React from "react";
import { Switch, Text, View } from "react-native";
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
