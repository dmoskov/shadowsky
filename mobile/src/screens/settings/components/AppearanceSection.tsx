import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function AppearanceSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const styles = createSectionStyles(themeColors);

  if (!preferences) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>APPEARANCE</Text>

      <SettingRow label="Theme">
        <View style={styles.themeSelector}>
          {(["dark", "light", "system"] as const).map((theme) => (
            <TouchableOpacity
              key={theme}
              style={[
                styles.themeButton,
                preferences.theme === theme && styles.themeButtonActive,
              ]}
              onPress={() => updatePreference("theme", theme)}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  preferences.theme === theme && styles.themeButtonTextActive,
                ]}
              >
                {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SettingRow>
    </View>
  );
}
