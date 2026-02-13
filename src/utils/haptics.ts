import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { preferencesService } from "../../mobile/src/services/preferences";

export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "error"
  | "selection";

/**
 * Trigger haptic feedback on supported devices
 * Respects user's haptic preference setting
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  // Only trigger haptics on mobile platforms
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return;
  }

  try {
    // Check if haptics are enabled in user preferences
    const preferences = await preferencesService.get();
    if (preferences.hapticsEnabled === false) {
      return;
    }

    // Map haptic types to expo-haptics functions
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
    }
  } catch (_error) {
    // Silently fail if haptics are not supported or error occurs
    // Don't log to avoid noise in development
  }
}
