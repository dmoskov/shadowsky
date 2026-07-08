/**
 * Notification Bridge Expo Module
 *
 * Standalone native module for passing serialized notification data to Swift.
 * Kept as its own package (mirroring feed-bridge) because Expo's local-module
 * registration only registers one module class per package — a second module
 * bolted onto native-notifications-list never registered at runtime.
 */

import { NativeModule, requireNativeModule } from "expo";

export interface NotificationBridgeModule extends NativeModule {
  /** Pass serialized, processed notification data to Swift as a JSON string. */
  updateNotificationData(jsonData: string): void;
  /** Clear notification data in Swift. */
  clearNotificationData(): void;
}

export default requireNativeModule<NotificationBridgeModule>(
  "NotificationBridge",
);
