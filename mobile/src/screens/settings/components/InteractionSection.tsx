import React from "react";
import { Switch, Text, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function InteractionSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
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
      <Text style={styles.sectionTitle}>INTERACTION</Text>

      <SettingRow
        label="Haptic Feedback"
        description="Vibrate on interactions like likes and posts"
      >
        <Switch
          value={preferences.hapticsEnabled}
          onValueChange={(value) => updatePreference("hapticsEnabled", value)}
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>

      <SettingRow
        label="Swipe Actions"
        description="Swipe posts to reply, like, bookmark, or repost"
      >
        <Switch
          value={preferences.swipeActionsEnabled}
          onValueChange={(value) =>
            updatePreference("swipeActionsEnabled", value)
          }
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>
    </View>
  );
}
