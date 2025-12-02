/**
 * usePushNotifications Hook
 *
 * React hook for managing push notifications - subscription, permission,
 * settings, and integration with the push notification service.
 */

import { useCallback, useEffect, useState } from "react";
import { pushNotificationService } from "../services/push-notification-service";
import {
  DEFAULT_PUSH_SETTINGS,
  type PushNotificationSettings,
  PushServiceWorkerMessageType,
  type PushSubscriptionStatus,
} from "../types/push-notifications";

interface UsePushNotificationsReturn {
  // Status
  status: PushSubscriptionStatus;
  isLoading: boolean;
  error: string | null;

  // Settings
  settings: PushNotificationSettings;

  // Actions
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  updateSettings: (
    settings: Partial<PushNotificationSettings>,
  ) => Promise<void>;
  clearNotifications: (tag?: string) => Promise<void>;
  showTestNotification: () => Promise<void>;

  // Prompt state
  isDismissed: boolean;
  setDismissed: (dismissed: boolean) => void;
}

/**
 * Hook for managing push notifications
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [status, setStatus] = useState<PushSubscriptionStatus>({
    isSupported: false,
    permission: "prompt",
    isSubscribed: false,
    subscription: null,
  });
  const [settings, setSettings] = useState<PushNotificationSettings>(
    DEFAULT_PUSH_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissedState] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        await pushNotificationService.init();
        const currentStatus = await pushNotificationService.getStatus();
        setStatus(currentStatus);
        setSettings(pushNotificationService.getSettings());
        setIsDismissedState(pushNotificationService.isDismissed());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Listen for service worker messages
    const unsubscribeClick = pushNotificationService.onMessage(
      PushServiceWorkerMessageType.NOTIFICATION_CLICK,
      (payload) => {
        // Handle notification click - could navigate or update state
        const data = payload as { url?: string };
        if (data.url) {
          // The service worker should handle navigation, but we can update state
          window.dispatchEvent(
            new CustomEvent("pushNotificationClick", { detail: data }),
          );
        }
      },
    );

    const unsubscribeReceived = pushNotificationService.onMessage(
      PushServiceWorkerMessageType.PUSH_RECEIVED,
      () => {
        // Could increment unread count or trigger refresh
        window.dispatchEvent(new CustomEvent("pushNotificationReceived"));
      },
    );

    return () => {
      unsubscribeClick();
      unsubscribeReceived();
    };
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.subscribe();
      const newStatus = await pushNotificationService.getStatus();
      setStatus(newStatus);
      setSettings(pushNotificationService.getSettings());
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Subscription failed";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.unsubscribe();
      const newStatus = await pushNotificationService.getStatus();
      setStatus(newStatus);
      setSettings(pushNotificationService.getSettings());
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unsubscribe failed";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request permission
  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      setIsLoading(true);
      setError(null);

      try {
        const permission = await pushNotificationService.requestPermission();
        const newStatus = await pushNotificationService.getStatus();
        setStatus(newStatus);
        return permission;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Permission request failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, []);

  // Update settings
  const updateSettings = useCallback(
    async (newSettings: Partial<PushNotificationSettings>): Promise<void> => {
      try {
        await pushNotificationService.updateSettings(newSettings);
        setSettings(pushNotificationService.getSettings());
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Settings update failed";
        setError(message);
        throw err;
      }
    },
    [],
  );

  // Clear notifications
  const clearNotifications = useCallback(
    async (tag?: string): Promise<void> => {
      try {
        await pushNotificationService.clearNotifications(tag);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Clear failed";
        setError(message);
      }
    },
    [],
  );

  // Show test notification
  const showTestNotification = useCallback(async (): Promise<void> => {
    try {
      await pushNotificationService.showLocalNotification({
        type: "notification",
        title: "Test Notification",
        body: "Push notifications are working! 🎉",
        icon: "/butterfly-icon.svg",
        tag: "test-notification",
        data: {
          url: "/notifications",
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Test notification failed";
      setError(message);
      throw err;
    }
  }, []);

  // Set dismissed
  const setDismissed = useCallback((dismissed: boolean): void => {
    pushNotificationService.setDismissed(dismissed);
    setIsDismissedState(dismissed);
  }, []);

  return {
    status,
    isLoading,
    error,
    settings,
    subscribe,
    unsubscribe,
    requestPermission,
    updateSettings,
    clearNotifications,
    showTestNotification,
    isDismissed,
    setDismissed,
  };
}

/**
 * Hook for just checking push notification support
 */
export function usePushNotificationSupport(): {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
} {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  return { isSupported, permission };
}
