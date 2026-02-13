import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const APP_LOCK_ENABLED_KEY = "@shadowsky_app_lock_enabled";
const LAST_BACKGROUND_TIME_KEY = "@shadowsky_last_background_time";

// Grace period in milliseconds (30 seconds)
const GRACE_PERIOD = 30 * 1000;

export interface BiometricCapability {
  isSupported: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricType: "fingerprint" | "facial" | "iris" | "unknown" | null;
}

class AppLockService {
  /**
   * Check if biometric authentication is supported on the device
   */
  async isSupported(): Promise<BiometricCapability> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: BiometricCapability["biometricType"] = null;
      if (supportedTypes.length > 0) {
        if (
          supportedTypes.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          biometricType = "facial";
        } else if (
          supportedTypes.includes(
            LocalAuthentication.AuthenticationType.FINGERPRINT,
          )
        ) {
          biometricType = "fingerprint";
        } else if (
          supportedTypes.includes(
            LocalAuthentication.AuthenticationType.IRIS,
          )
        ) {
          biometricType = "iris";
        } else {
          biometricType = "unknown";
        }
      }

      return {
        isSupported: hasHardware && isEnrolled,
        hasHardware,
        isEnrolled,
        biometricType,
      };
    } catch (error) {
      console.error("Error checking biometric support:", error);
      return {
        isSupported: false,
        hasHardware: false,
        isEnrolled: false,
        biometricType: null,
      };
    }
  }

  /**
   * Get user-friendly biometric type name
   */
  getBiometricTypeName(biometricType: BiometricCapability["biometricType"]): string {
    switch (biometricType) {
      case "facial":
        return "Face ID";
      case "fingerprint":
        return "Touch ID";
      case "iris":
        return "Iris";
      default:
        return "Biometric";
    }
  }

  /**
   * Prompt for biometric authentication
   */
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      const capability = await this.isSupported();

      if (!capability.isSupported) {
        return {
          success: false,
          error: capability.hasHardware
            ? "No biometrics enrolled. Please set up Face ID or Touch ID in your device settings."
            : "Biometric authentication is not available on this device.",
        };
      }

      const biometricName = this.getBiometricTypeName(capability.biometricType);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock Asphodel with ${biometricName}`,
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return {
        success: false,
        error: "An error occurred during authentication",
      };
    }
  }

  /**
   * Check if app lock is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      return enabled === "true";
    } catch (error) {
      console.error("Error checking app lock status:", error);
      return false;
    }
  }

  /**
   * Enable or disable app lock
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        // Check if biometrics are supported before enabling
        const capability = await this.isSupported();
        if (!capability.isSupported) {
          throw new Error(
            "Cannot enable app lock: Biometric authentication is not available",
          );
        }
      }

      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? "true" : "false");
    } catch (error) {
      console.error("Error setting app lock status:", error);
      throw error;
    }
  }

  /**
   * Record the time when the app goes to background
   */
  async recordBackgroundTime(): Promise<void> {
    try {
      const now = Date.now().toString();
      await AsyncStorage.setItem(LAST_BACKGROUND_TIME_KEY, now);
    } catch (error) {
      console.error("Error recording background time:", error);
    }
  }

  /**
   * Check if authentication is required based on grace period
   * Returns true if app has been in background for longer than grace period
   */
  async shouldRequireAuthentication(): Promise<boolean> {
    try {
      const lastBackgroundTime = await AsyncStorage.getItem(
        LAST_BACKGROUND_TIME_KEY,
      );

      if (!lastBackgroundTime) {
        // First time or no background time recorded, require auth
        return true;
      }

      const elapsed = Date.now() - parseInt(lastBackgroundTime, 10);
      return elapsed > GRACE_PERIOD;
    } catch (error) {
      console.error("Error checking authentication requirement:", error);
      // Err on the side of security
      return true;
    }
  }

  /**
   * Clear the background time (e.g., after successful authentication)
   */
  async clearBackgroundTime(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_BACKGROUND_TIME_KEY);
    } catch (error) {
      console.error("Error clearing background time:", error);
    }
  }
}

export const appLockService = new AppLockService();
