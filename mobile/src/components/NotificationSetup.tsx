import {useEffect} from 'react';
import {
  useNotificationPermissions,
  configureNotificationHandler,
} from '../hooks/useNotificationPermissions';
import {useNotificationHandler} from '../hooks/useNotificationHandler';
import {startNotificationPoller, stopNotificationPoller} from '../services/notification-poller';
import {useAuth} from '../contexts/AuthContext';

/**
 * Component to initialize and manage push notifications
 * This should be mounted when the user is authenticated
 */
export function NotificationSetup() {
  const {isAuthenticated} = useAuth();
  const {hasPermission, permissionStatus, requestPermission, hasAskedBefore} =
    useNotificationPermissions();

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

  // Start/stop poller based on authentication and permission
  useEffect(() => {
    if (isAuthenticated && hasPermission) {
      startNotificationPoller();
      return () => {
        stopNotificationPoller();
      };
    }
  }, [isAuthenticated, hasPermission]);

  // This component doesn't render anything
  return null;
}
