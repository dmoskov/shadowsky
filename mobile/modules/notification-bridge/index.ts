/**
 * Notification Bridge Module
 *
 * Expo module for passing notification data from React to Swift
 */

import { NativeModulesProxy } from 'expo-modules-core';

const NotificationBridge = NativeModulesProxy.NotificationBridge;

export default NotificationBridge;
