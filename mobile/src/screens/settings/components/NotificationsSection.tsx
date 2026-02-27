import { useRouter } from "expo-router";
import React from "react";
import { Switch, Text, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function NotificationsSection() {
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
      <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

      <SettingRow
        label="Notification Preferences"
        description="Choose which notifications to receive"
        onPress={() => router.push("/(app)/settings/notification-preferences")}
        showChevron
      />

      <SettingRow
        label="Enable Notifications"
        description="Master toggle for all notifications"
      >
        <Switch
          value={preferences.notificationsEnabled}
          onValueChange={(value) =>
            updatePreference("notificationsEnabled", value)
          }
          trackColor={switchColors.trackColor}
          thumbColor={switchColors.thumbColor}
        />
      </SettingRow>

      {preferences.notificationsEnabled && (
        <>
          <SettingRow label="Likes">
            <Switch
              value={preferences.notifyOnLikes}
              onValueChange={(value) =>
                updatePreference("notifyOnLikes", value)
              }
              trackColor={switchColors.trackColor}
              thumbColor={switchColors.thumbColor}
            />
          </SettingRow>

          <SettingRow label="Replies">
            <Switch
              value={preferences.notifyOnReplies}
              onValueChange={(value) =>
                updatePreference("notifyOnReplies", value)
              }
              trackColor={switchColors.trackColor}
              thumbColor={switchColors.thumbColor}
            />
          </SettingRow>

          <SettingRow label="Follows">
            <Switch
              value={preferences.notifyOnFollows}
              onValueChange={(value) =>
                updatePreference("notifyOnFollows", value)
              }
              trackColor={switchColors.trackColor}
              thumbColor={switchColors.thumbColor}
            />
          </SettingRow>

          <SettingRow label="Mentions">
            <Switch
              value={preferences.notifyOnMentions}
              onValueChange={(value) =>
                updatePreference("notifyOnMentions", value)
              }
              trackColor={switchColors.trackColor}
              thumbColor={switchColors.thumbColor}
            />
          </SettingRow>

          <SettingRow label="Quotes">
            <Switch
              value={preferences.notifyOnQuotes}
              onValueChange={(value) =>
                updatePreference("notifyOnQuotes", value)
              }
              trackColor={switchColors.trackColor}
              thumbColor={switchColors.thumbColor}
            />
          </SettingRow>
        </>
      )}
    </View>
  );
}
