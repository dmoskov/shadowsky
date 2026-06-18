/**
 * Notification Bridge native module accessor.
 *
 * Passes serialized notification data to the native SwiftUI list, which
 * observes the posted NotificationCenter events. Mirrors feed-bridge.
 */

import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface NotificationBridgeModule extends NativeModule {
  /** Pass serialized, processed notification data to Swift as a JSON string. */
  updateNotificationData(jsonData: string): void;
  /** Clear notification data in Swift. */
  clearNotificationData(): void;
}

let NotificationBridge: NotificationBridgeModule | null = null;

if (Platform.OS === "ios") {
  NotificationBridge =
    requireNativeModule<NotificationBridgeModule>("NotificationBridge");
}

export default NotificationBridge;
