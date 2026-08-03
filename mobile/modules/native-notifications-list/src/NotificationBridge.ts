/**
 * Notification Bridge native module accessor.
 *
 * Passes serialized notification data to the native SwiftUI list, which
 * observes the posted NotificationCenter events. Lives in its own
 * `notification-bridge` package (mirroring feed-bridge) — Expo's local-module
 * registration only registers one module class per package, so this can't be a
 * second module inside native-notifications-list.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface NotificationBridgeModule extends NativeModule {
  /** Pass serialized, processed notification data to Swift as a JSON string. */
  updateNotificationData(jsonData: string): void;
  /** Clear notification data in Swift. */
  clearNotificationData(): void;
}

let NotificationBridge: NotificationBridgeModule | null = null;

if (Platform.OS === "ios") {
  // Use the optional variant so a missing native module degrades gracefully
  // (notifications render without native data) instead of crashing the route.
  NotificationBridge =
    requireOptionalNativeModule<NotificationBridgeModule>("NotificationBridge");
}

export default NotificationBridge;
