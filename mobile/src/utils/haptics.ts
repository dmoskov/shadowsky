import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { preferencesService } from "../services/preferences";

export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "error"
  | "selection";

/**
 * Trigger haptic feedback with the specified type
 * Respects user preference settings
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  // Check if haptics are enabled in preferences
  const preferences = await preferencesService.get();
  if (!preferences.hapticsEnabled) {
    return;
  }

  // Only trigger haptics on native platforms
  if (Platform.OS === "web") {
    return;
  }

  try {
    switch (type) {
      case "light":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "success":
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        break;
      case "error":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case "selection":
        await Haptics.selectionAsync();
        break;
      default:
        // Default to light impact if unknown type
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (error) {
    // Silently fail if haptics are not supported on the device
    console.debug("Failed to trigger haptic feedback:", error);
  }
}

/**
 * Convenience functions for common haptic patterns
 */
export const haptics = {
  light: () => triggerHaptic("light"),
  medium: () => triggerHaptic("medium"),
  heavy: () => triggerHaptic("heavy"),
  success: () => triggerHaptic("success"),
  error: () => triggerHaptic("error"),
  selection: () => triggerHaptic("selection"),
};
