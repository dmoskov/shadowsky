import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { appLockService } from "../services/app-lock";
import { colors } from "../constants/theme";


import { createLogger } from '../utils/logger';

const logger = createLogger('Applockscreenx');
interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("Biometric");

  useEffect(() => {
    // Get biometric type for display
    appLockService.isSupported().then((capability) => {
      if (capability.biometricType) {
        setBiometricType(
          appLockService.getBiometricTypeName(capability.biometricType),
        );
      }
    });

    // Automatically attempt authentication on mount
    handleAuthenticate();
  }, []);

  const handleAuthenticate = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    try {
      const result = await appLockService.authenticate();

      if (result.success) {
        // Clear background time so we don't re-prompt immediately
        await appLockService.clearBackgroundTime();
        onUnlock();
      } else {
        // Show error if authentication failed
        if (result.error) {
          Alert.alert(
            "Authentication Failed",
            result.error,
            [
              {
                text: "Try Again",
                onPress: () => handleAuthenticate(),
              },
              {
                text: "Cancel",
                style: "cancel",
              },
            ],
          );
        }
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      Alert.alert(
        "Error",
        "An error occurred during authentication. Please try again.",
        [
          {
            text: "Try Again",
            onPress: () => handleAuthenticate(),
          },
        ],
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Icon/Logo placeholder */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>A</Text>
        </View>

        <Text style={styles.title}>Asphodel</Text>
        <Text style={styles.subtitle}>App is locked</Text>

        {isAuthenticating ? (
          <View style={styles.authenticatingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.authenticatingText}>Authenticating...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={handleAuthenticate}
            activeOpacity={0.8}
          >
            <Text style={styles.unlockButtonText}>
              Unlock with {biometricType}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.helpText}>
          Use {biometricType} or your device passcode to unlock
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    width: "100%",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  iconText: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "bold",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 48,
  },
  authenticatingContainer: {
    alignItems: "center",
    gap: 16,
  },
  authenticatingText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  unlockButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    minWidth: 240,
    alignItems: "center",
    marginBottom: 24,
  },
  unlockButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  helpText: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
