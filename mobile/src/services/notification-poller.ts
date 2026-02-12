import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, AppStateStatus} from 'react-native';
import {getUnreadCount} from './atproto/notifications';
import {preferencesService} from './preferences';

const STORAGE_KEY = '@shadowsky/last_unread_count';
const POLL_INTERVAL = 60000; // 60 seconds

/**
 * Get last known unread count from storage
 */
async function getLastUnreadCount(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(STORAGE_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error loading last unread count:', error);
    return 0;
  }
}

/**
 * Save unread count to storage
 */
async function saveUnreadCount(count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, count.toString());
  } catch (error) {
    console.error('Error saving unread count:', error);
  }
}

/**
 * Schedule a local notification
 */
async function scheduleNotification(count: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Notifications',
        body: `You have ${count} new ${count === 1 ? 'notification' : 'notifications'}`,
        data: {unreadCount: count},
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

/**
 * Update app badge count
 */
async function updateBadgeCount(count: number): Promise<void> {
  try {
    if (Device.isDevice) {
      await Notifications.setBadgeCountAsync(count);
    }
  } catch (error) {
    console.error('Error updating badge count:', error);
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: any = null;
let currentAppState: AppStateStatus = 'active';

/**
 * Poll for new notifications
 */
async function pollNotifications(): Promise<void> {
  try {
    // Get preferences from the preferences service
    const prefs = await preferencesService.get();
    if (!prefs.notificationsEnabled) {
      return;
    }

    // Get current unread count from API
    const currentCount = await getUnreadCount();

    // Get last known count
    const lastCount = await getLastUnreadCount();

    // Update badge count always (even in foreground)
    await updateBadgeCount(currentCount);

    // Only show notification if count increased and app is in background
    if (currentCount > lastCount && currentAppState !== 'active') {
      const newNotifications = currentCount - lastCount;
      await scheduleNotification(newNotifications);
    }

    // Save current count
    await saveUnreadCount(currentCount);
  } catch (error) {
    console.error('Error polling notifications:', error);
  }
}

/**
 * Handle app state change
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  currentAppState = nextAppState;

  if (nextAppState === 'background') {
    // App went to background, poll immediately
    pollNotifications();
  }
}

/**
 * Start the notification poller
 */
export function startNotificationPoller(): void {
  // Don't start if already running
  if (pollingInterval) {
    return;
  }

  // Subscribe to app state changes
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Start polling
  pollingInterval = setInterval(pollNotifications, POLL_INTERVAL);

  // Poll immediately on start
  pollNotifications();
}

/**
 * Stop the notification poller
 */
export function stopNotificationPoller(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

/**
 * Clear app badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await updateBadgeCount(0);
}
