import {useEffect, useRef} from 'react';
import * as Notifications from 'expo-notifications';
import {useRouter} from 'expo-router';
import {clearBadgeCount} from '../utils/badge';

/**
 * Handle notification tap and navigate to appropriate screen
 */
function handleNotificationNavigation(
  router: any,
  data: Record<string, any> | undefined,
) {
  if (!data) {
    // Default to notifications tab
    router.push('/(tabs)/notifications' as never);
    return;
  }

  // Handle different notification types
  switch (data.type) {
    case 'post':
    case 'thread':
      // Navigate to specific post/thread
      if (data.postId) {
        router.push(`/(tabs)/(home)/thread/${data.postId}` as never);
      } else {
        router.push('/(tabs)/notifications' as never);
      }
      break;

    case 'profile':
      // Navigate to specific profile
      if (data.handle) {
        router.push(`/(tabs)/(home)/profile/${data.handle}` as never);
      } else {
        router.push('/(tabs)/notifications' as never);
      }
      break;

    case 'dm':
    case 'message':
      // Navigate to messages
      router.push('/(app)/profile/messages' as never);
      break;

    case 'notification':
    default:
      // Navigate to notifications tab
      router.push('/(tabs)/notifications' as never);
      break;
  }
}

/**
 * Hook to handle notification interactions (tap, receive, etc.)
 */
export function useNotificationHandler() {
  const router = useRouter();
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification: Notifications.Notification) => {
      // The notification handler configured in useNotificationPermissions
      // will determine if it shows as a banner
    });

    // Listen for user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;

      // Navigate based on notification data
      handleNotificationNavigation(router, data);

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
