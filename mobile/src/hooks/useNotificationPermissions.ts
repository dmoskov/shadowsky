import {useEffect, useState} from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors} from '../constants/theme';

const PERMISSION_STORAGE_KEY = '@shadowsky/notification_permission_asked';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface NotificationPermissions {
  hasPermission: boolean;
  permissionStatus: PermissionStatus;
  requestPermission: () => Promise<boolean>;
  hasAskedBefore: boolean;
}

/**
 * Hook to manage notification permissions
 */
export function useNotificationPermissions(): NotificationPermissions {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [hasAskedBefore, setHasAskedBefore] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  /**
   * Check current permission status
   */
  async function checkPermissions(): Promise<void> {
    try {
      // Check if we've asked before
      const asked = await AsyncStorage.getItem(PERMISSION_STORAGE_KEY);
      setHasAskedBefore(asked === 'true');

      if (!Device.isDevice) {
        // Simulator/emulator - no real notifications
        setPermissionStatus('undetermined');
        setHasPermission(false);
        return;
      }

      const {status} = await Notifications.getPermissionsAsync();
      updatePermissionState(status);
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      setPermissionStatus('undetermined');
      setHasPermission(false);
    }
  }

  /**
   * Request notification permissions
   */
  async function requestPermission(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('Cannot request permissions on simulator/emulator');
        return false;
      }

      // Mark that we've asked for permission
      await AsyncStorage.setItem(PERMISSION_STORAGE_KEY, 'true');
      setHasAskedBefore(true);

      const {status} = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      updatePermissionState(status);
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Update permission state based on status
   */
  function updatePermissionState(status: Notifications.PermissionStatus): void {
    const granted = status === 'granted';
    setHasPermission(granted);

    if (granted) {
      setPermissionStatus('granted');
    } else if (status === 'denied') {
      setPermissionStatus('denied');
    } else {
      setPermissionStatus('undetermined');
    }
  }

  return {
    hasPermission,
    permissionStatus,
    requestPermission,
    hasAskedBefore,
  };
}

/**
 * Configure notification handler for foreground notifications
 * Call this once in your app initialization
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    // Configure Android notification channel
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primary,
    });
  }
}
