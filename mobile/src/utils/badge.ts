import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {createLogger} from './logger';

const logger = createLogger('Badge');

/**
 * Update app badge count
 */
export async function updateBadgeCount(count: number): Promise<void> {
  try {
    if (Device.isDevice) {
      await Notifications.setBadgeCountAsync(count);
    }
  } catch (error) {
    logger.error('Error updating badge count:', error);
  }
}

/**
 * Clear app badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await updateBadgeCount(0);
}
