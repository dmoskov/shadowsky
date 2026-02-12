import {useEffect, useRef} from 'react';
import * as Notifications from 'expo-notifications';
import {useRouter} from 'expo-router';
import {clearBadgeCount} from '../services/notification-poller';

/**
 * Hook to handle notification interactions (tap, receive, etc.)
 */
export function useNotificationHandler() {
  const router = useRouter();
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      // The notification handler configured in useNotificationPermissions
      // will determine if it shows as a banner
    });

    // Listen for user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);

      // Navigate to Notifications tab when user taps notification
      router.push('/(tabs)/notifications');

      // Clear badge count when user opens from notification
      clearBadgeCount();
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);
}
