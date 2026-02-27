import React, { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { appLockService } from "../../../services/app-lock";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";

export function SecuritySection() {
  const { preferences, updatePreference } = usePreferences();
  const { colors: themeColors } = useTheme();
  const styles = createSectionStyles(themeColors);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("Biometric");

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const capability = await appLockService.isSupported();
    setBiometricsSupported(capability.isSupported);
    if (capability.biometricType) {
      setBiometricType(
        appLockService.getBiometricTypeName(capability.biometricType),
      );
    }
  };

  if (!biometricsSupported || !preferences) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SECURITY</Text>

      <SettingRow
        label="App Lock"
        description={`Require ${biometricType} to open the app`}
      >
        <Switch
          value={preferences.appLockEnabled}
          onValueChange={async (value) => {
            try {
              if (value) {
                const result = await appLockService.authenticate();
                if (result.success) {
                  await appLockService.setEnabled(true);
                  await updatePreference("appLockEnabled", true);
                  Alert.alert(
                    "App Lock Enabled",
                    `${biometricType} will be required to unlock the app after 30 seconds of inactivity.`,
                  );
                } else {
                  Alert.alert(
                    "Authentication Failed",
                    result.error || "Could not verify your identity",
                  );
                }
              } else {
                await appLockService.setEnabled(false);
                await updatePreference("appLockEnabled", false);
              }
            } catch {
              Alert.alert(
                "Error",
                "Failed to update app lock setting. Please try again.",
              );
            }
          }}
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
