import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function PrivacySection() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const styles = createSectionStyles(themeColors);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRIVACY & ACCESSIBILITY</Text>

      <SettingRow
        label="Privacy & Safety"
        description="Control who can interact with you"
        onPress={() => router.push("/(app)/settings/privacy")}
        showChevron
      />

      <SettingRow
        label="Accessibility"
        description="Display, motion, and screen reader settings"
        onPress={() => router.push("/(app)/settings/accessibility")}
        showChevron
      />
    </View>
  );
}
