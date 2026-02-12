import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BskyAgent} from '@atproto/api';

const PUSH_TOKEN_STORAGE_KEY = '@shadowsky/push_token';
const PUSH_TOKEN_RECORD_KEY = 'self'; // Singleton record
const PUSH_TOKEN_COLLECTION = 'com.shadowsky.pushToken';

export interface PushTokenRecord {
  token: string;
  platform: 'ios' | 'android';
  deviceId: string;
  updatedAt: string;
}

/**
 * Get stored push token from local storage
 */
async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('Error getting stored push token:', error);
    return null;
  }
}

/**
 * Save push token to local storage
 */
async function savePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Register for push notifications and get Expo Push Token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Only register on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Check if we have permission
    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const {status} = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get Expo Push Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('Expo project ID not configured');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log('Got Expo Push Token:', token);

    // Save token locally
    await savePushToken(token);

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save push token to AT Protocol
 */
export async function savePushTokenToATProto(
  agent: BskyAgent,
  token: string,
): Promise<boolean> {
  try {
    const deviceId = Constants.deviceId || 'unknown';
    const platform = Platform.OS as 'ios' | 'android';

    const record: PushTokenRecord = {
      token,
      platform,
      deviceId,
      updatedAt: new Date().toISOString(),
    };

    // Save as singleton record
    await agent.com.atproto.repo.putRecord({
      repo: agent.session?.did || '',
      collection: PUSH_TOKEN_COLLECTION,
      rkey: PUSH_TOKEN_RECORD_KEY,
      record,
    });

    console.log('Push token saved to AT Protocol');
    return true;
  } catch (error) {
    console.error('Error saving push token to AT Protocol:', error);
    return false;
  }
}

/**
 * Get push token from AT Protocol
 */
export async function getPushTokenFromATProto(
  agent: BskyAgent,
): Promise<PushTokenRecord | null> {
  try {
    const response = await agent.com.atproto.repo.getRecord({
      repo: agent.session?.did || '',
      collection: PUSH_TOKEN_COLLECTION,
      rkey: PUSH_TOKEN_RECORD_KEY,
    });

    return response.data.value as PushTokenRecord;
  } catch (error) {
    // 400 error means record doesn't exist yet, which is normal
    if ((error as any)?.status === 400) {
      return null;
    }
    console.error('Error getting push token from AT Protocol:', error);
    return null;
  }
}

/**
 * Check if push token needs to be updated
 */
export async function shouldUpdatePushToken(
  agent: BskyAgent,
  currentToken: string,
): Promise<boolean> {
  const storedRecord = await getPushTokenFromATProto(agent);

  if (!storedRecord) {
    return true; // No record exists, need to create
  }

  // Update if token changed
  if (storedRecord.token !== currentToken) {
    return true;
  }

  // Update if device ID changed
  const currentDeviceId = Constants.deviceId || 'unknown';
  if (storedRecord.deviceId !== currentDeviceId) {
    return true;
  }

  return false;
}

/**
 * Initialize push notifications
 * Call this after user is authenticated
 */
export async function initializePushNotifications(
  agent: BskyAgent,
): Promise<boolean> {
  try {
    // Register for push notifications and get token
    const token = await registerForPushNotifications();

    if (!token) {
      console.log('Could not get push token');
      return false;
    }

    // Check if we need to update the token in AT Protocol
    const needsUpdate = await shouldUpdatePushToken(agent, token);

    if (needsUpdate) {
      const saved = await savePushTokenToATProto(agent, token);
      if (!saved) {
        console.error('Failed to save push token to AT Protocol');
        return false;
      }
    }

    console.log('Push notifications initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
}

/**
 * Unregister push notifications
 * Call this when user logs out
 */
export async function unregisterPushNotifications(
  agent: BskyAgent,
): Promise<void> {
  try {
    // Delete the push token record from AT Protocol
    await agent.com.atproto.repo.deleteRecord({
      repo: agent.session?.did || '',
      collection: PUSH_TOKEN_COLLECTION,
      rkey: PUSH_TOKEN_RECORD_KEY,
    });

    // Clear local storage
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);

    console.log('Push notifications unregistered');
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
}
