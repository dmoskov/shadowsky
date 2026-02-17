import {useEffect, useState} from 'react';
import {
  useNotificationPermissions,
  configureNotificationHandler,
} from '../hooks/useNotificationPermissions';
import {useNotificationHandler} from '../hooks/useNotificationHandler';
import {initializePushNotifications} from '../services/push-notification-service';
import {registerNotificationCategories} from '../services/notification-categories';
import {useAuth} from '../contexts/AuthContext';
import {getAgent} from '../services/atproto/client';

import {createLogger} from '../utils/logger';

const logger = createLogger('NotificationSetup');
/**
 * Component to initialize and manage push notifications
 * This should be mounted when the user is authenticated
 */
export function NotificationSetup() {
  const {isAuthenticated} = useAuth();
  const {hasPermission, permissionStatus, requestPermission, hasAskedBefore} =
    useNotificationPermissions();
  const [pushInitialized, setPushInitialized] = useState(false);

  // Set up notification handler for foreground/background
  useNotificationHandler();

  // Configure notification handler and register action categories on mount
  useEffect(() => {
    configureNotificationHandler();
    registerNotificationCategories();
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

          if (mounted && success) {
            setPushInitialized(true);
          }
        } catch (error) {
          logger.error('Error setting up push notifications:', error);
        }
      }
    }

    setupPushNotifications();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, hasPermission, pushInitialized]);

  // This component doesn't render anything
  return null;
}
