/**
 * Notification Bridge Expo Module
 *
 * Native module for passing serialized notification data to Swift.
 */

import {NativeModule, requireNativeModule} from 'expo';

export interface NotificationBridgeModule extends NativeModule {
  updateNotificationData(jsonData: string): void;
  clearNotificationData(): void;
}

export default requireNativeModule<NotificationBridgeModule>('NotificationBridge');
