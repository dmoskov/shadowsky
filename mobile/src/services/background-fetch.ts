/**
 * Background fetch service for pre-loading fresh content
 *
 * This service runs periodically in the background (when app is closed)
 * to fetch timeline posts and notification counts, so users see fresh
 * content immediately when opening the app.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTimeline } from './atproto/feeds';
import { getUnreadCount } from './atproto/notifications';
import { preferencesService } from './preferences';

const BACKGROUND_FETCH_TASK = 'background-fetch-task';
const PREFETCH_STORAGE_KEY = '@shadowsky/prefetch_data';
const PREFETCH_TIMESTAMP_KEY = '@shadowsky/prefetch_timestamp';

export interface PrefetchData {
  timeline?: {
    feed: any[];
    cursor?: string;
  };
  unreadCount?: number;
  timestamp: number;
}

/**
 * Save prefetched data to AsyncStorage
 */
async function savePrefetchData(data: PrefetchData): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFETCH_STORAGE_KEY, JSON.stringify(data));
    await AsyncStorage.setItem(PREFETCH_TIMESTAMP_KEY, data.timestamp.toString());
  } catch (error) {
    console.error('[BackgroundFetch] Error saving prefetch data:', error);
  }
}

/**
 * Load prefetched data from AsyncStorage
 */
export async function loadPrefetchData(): Promise<PrefetchData | null> {
  try {
    const data = await AsyncStorage.getItem(PREFETCH_STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as PrefetchData;
  } catch (error) {
    console.error('[BackgroundFetch] Error loading prefetch data:', error);
    return null;
  }
}

/**
 * Check if prefetched data is stale (older than 15 minutes)
 */
export async function isPrefetchDataStale(): Promise<boolean> {
  try {
    const timestamp = await AsyncStorage.getItem(PREFETCH_TIMESTAMP_KEY);
    if (!timestamp) {
      return true;
    }
    const age = Date.now() - parseInt(timestamp, 10);
    const fifteenMinutes = 15 * 60 * 1000;
    return age > fifteenMinutes;
  } catch (error) {
    console.error('[BackgroundFetch] Error checking prefetch staleness:', error);
    return true;
  }
}

/**
 * Update badge count
 */
async function updateBadgeCount(count: number): Promise<void> {
  try {
    if (Device.isDevice) {
      await Notifications.setBadgeCountAsync(count);
    }
  } catch (error) {
    console.error('[BackgroundFetch] Error updating badge count:', error);
  }
}

/**
 * Background fetch task handler
 * This runs periodically when the app is in the background
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[BackgroundFetch] Starting background fetch task');

    // Check if user has enabled background fetch
    const prefs = await preferencesService.get();
    if (!prefs.backgroundFetchEnabled) {
      console.log('[BackgroundFetch] Background fetch disabled in preferences');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const prefetchData: PrefetchData = {
      timestamp: Date.now(),
    };

    // Fetch first page of timeline (lightweight, no images)
    try {
      const timelineResult = await getTimeline({ limit: 20 });
      prefetchData.timeline = {
        feed: timelineResult.feed,
        cursor: timelineResult.cursor,
      };
      console.log(`[BackgroundFetch] Fetched ${timelineResult.feed.length} timeline posts`);
    } catch (error) {
      console.error('[BackgroundFetch] Error fetching timeline:', error);
    }

    // Fetch unread notification count
    try {
      const unreadCount = await getUnreadCount();
      prefetchData.unreadCount = unreadCount;

      // Update badge count
      await updateBadgeCount(unreadCount);
      console.log(`[BackgroundFetch] Unread count: ${unreadCount}`);
    } catch (error) {
      console.error('[BackgroundFetch] Error fetching unread count:', error);
    }

    // Save prefetched data to AsyncStorage
    await savePrefetchData(prefetchData);

    console.log('[BackgroundFetch] Background fetch completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundFetch] Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task
 * iOS minimum interval is 15 minutes
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    // Check if user has enabled background fetch
    const prefs = await preferencesService.get();
    if (!prefs.backgroundFetchEnabled) {
      console.log('[BackgroundFetch] Background fetch disabled, skipping registration');
      return;
    }

    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

    if (isRegistered) {
      console.log('[BackgroundFetch] Task already registered');
      return;
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate: false, // Continue even if app is terminated
      startOnBoot: true, // Start on device boot
    });

    console.log('[BackgroundFetch] Background fetch registered successfully');
  } catch (error) {
    console.error('[BackgroundFetch] Failed to register background fetch:', error);
  }
}

/**
 * Unregister the background fetch task
 */
export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('[BackgroundFetch] Background fetch unregistered successfully');
    }
  } catch (error) {
    console.error('[BackgroundFetch] Failed to unregister background fetch:', error);
  }
}

/**
 * Get background fetch status
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
  try {
    return await BackgroundFetch.getStatusAsync();
  } catch (error) {
    console.error('[BackgroundFetch] Failed to get status:', error);
    return null;
  }
}
