import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function ModerationSection() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const styles = createSectionStyles(themeColors);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>MODERATION</Text>

      <SettingRow
        label="Content Moderation"
        description="Control how labeled content is displayed"
        onPress={() => router.push("/(app)/settings/content-moderation")}
        showChevron
      />

      <SettingRow
        label="Labelers"
        description="Manage content labeling services"
        onPress={() => router.push("/(app)/settings/labelers")}
        showChevron
      />

      <SettingRow
        label="Moderation History"
        description="View your block, mute, and report actions"
        onPress={() => router.push("/(app)/settings/moderation-history")}
        showChevron
      />

      <SettingRow
        label="Blocked Accounts"
        description="Manage accounts you've blocked"
        onPress={() => router.push("/(app)/settings/blocked")}
        showChevron
      />

      <SettingRow
        label="Muted Accounts"
        description="Manage accounts you've muted"
        onPress={() => router.push("/(app)/settings/muted")}
        showChevron
      />

      <SettingRow
        label="Muted Words"
        description="Hide posts with specific words or phrases"
        onPress={() => router.push("/(app)/settings/muted-words")}
        showChevron
      />
    </View>
  );
}
