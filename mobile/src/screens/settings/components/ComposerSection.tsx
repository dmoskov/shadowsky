import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function ComposerSection() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const styles = createSectionStyles(themeColors);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>COMPOSER</Text>

      <SettingRow
        label="Composer Defaults"
        description="Thread numbering, post delay, and AI features"
        onPress={() => router.push("/(app)/settings/composer-defaults")}
        showChevron
      />
    </View>
  );
}
