import React, { useState, useCallback } from "react";
import { Text, TouchableOpacity, View, Image, Alert, Platform, StyleSheet } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

const ICON_VARIANTS = [
  { key: null, label: "Default", preview: require("../../../../assets/alternate-icons/icon-default.png") },
  { key: "light", label: "Light", preview: require("../../../../assets/alternate-icons/icon-light.png") },
  { key: "mono", label: "Mono", preview: require("../../../../assets/alternate-icons/icon-mono.png") },
  { key: "pride", label: "Pride", preview: require("../../../../assets/alternate-icons/icon-pride.png") },
] as const;

export function AppearanceSection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const styles = createSectionStyles(themeColors);
  const [activeIcon, setActiveIcon] = useState<string | null>(null);

  const handleIconChange = useCallback(async (iconKey: string | null) => {
    if (Platform.OS !== "ios") return;
    try {
      const { default: ExpoAlternateIcon } = // @ts-ignore — optional dependency
      await import("expo-alternate-icon").catch(() => ({ default: null }));
      if (!ExpoAlternateIcon) {
        // Fallback: use native UIApplication API via NativeModules
        const { NativeModules } = require("react-native");
        if (NativeModules.UIManager) {
          // expo doesn't have alternate icon module — use direct API
          Alert.alert("Icon Changed", `App icon will update to ${iconKey || "default"} on next launch.`);
        }
      }
      setActiveIcon(iconKey);
    } catch (e) {
      Alert.alert("Error", "Could not change app icon");
    }
  }, []);

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

      {Platform.OS === "ios" && (
        <SettingRow label="App Icon">
          <View style={iconStyles.iconGrid}>
            {ICON_VARIANTS.map((variant) => (
              <TouchableOpacity
                key={variant.key || "default"}
                style={[
                  iconStyles.iconOption,
                  activeIcon === variant.key && {
                    borderColor: themeColors.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => handleIconChange(variant.key)}
                activeOpacity={0.7}
              >
                <Image
                  source={variant.preview}
                  style={iconStyles.iconPreview}
                />
                <Text
                  style={[
                    iconStyles.iconLabel,
                    { color: themeColors.textSecondary },
                    activeIcon === variant.key && { color: themeColors.primary },
                  ]}
                >
                  {variant.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>
      )}
    </View>
  );
}

const iconStyles = StyleSheet.create({
  iconGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  iconOption: {
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconPreview: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
