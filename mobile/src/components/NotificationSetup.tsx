import {useEffect, useState} from 'react';
import {
  useNotificationPermissions,
  configureNotificationHandler,
} from '../hooks/useNotificationPermissions';
import {useNotificationHandler} from '../hooks/useNotificationHandler';
import {startNotificationPoller, stopNotificationPoller} from '../services/notification-poller';
import {initializePushNotifications} from '../services/push-notification-service';
import {useAuth} from '../contexts/AuthContext';
import {getAgent} from '../services/atproto/client';


import { createLogger } from '../utils/logger';

const logger = createLogger('Notificationsetupx');
/**
 * Component to initialize and manage push notifications
 * This should be mounted when the user is authenticated
 */
export function NotificationSetup() {
  const {isAuthenticated} = useAuth();
  const {hasPermission, permissionStatus, requestPermission, hasAskedBefore} =
    useNotificationPermissions();
  const [pushInitialized, setPushInitialized] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Set up notification handler for foreground/background
  useNotificationHandler();

  // Configure notification handler on mount
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Request permission on first app launch (after login)
  useEffect(() => {
    if (isAuthenticated && !hasAskedBefore && permissionStatus === 'undetermined') {
      // Wait a bit before asking for permission to not overwhelm the user
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasAskedBefore, permissionStatus, requestPermission]);

  // Initialize push notifications when authenticated and has permission
  useEffect(() => {
    let mounted = true;

    async function setupPushNotifications() {
      if (isAuthenticated && hasPermission && !pushInitialized) {
        try {
          const agent = await getAgent();
          const success = await initializePushNotifications(agent);

          if (mounted) {
            if (success) {
              setPushInitialized(true);
              setUseFallback(false);
            } else {
              // Push initialization failed, use polling fallback
              setUseFallback(true);
            }
          }
        } catch (error) {
          logger.error('Error setting up push notifications:', error);
          if (mounted) {
            setUseFallback(true);
          }
        }
      }
    }

    setupPushNotifications();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, hasPermission, pushInitialized]);

  // Start/stop poller as fallback if push initialization fails
  useEffect(() => {
    if (isAuthenticated && hasPermission && useFallback) {
      logger.log('Using polling fallback for notifications');
      startNotificationPoller();
      return () => {
        stopNotificationPoller();
      };
    }
  }, [isAuthenticated, hasPermission, useFallback]);

  // This component doesn't render anything
  return null;
}
