/**
 * Push Notification Service
 *
 * Manages push notification subscriptions, permissions, and communication
 * with the service worker for background push notifications.
 */

import {
  DEFAULT_PUSH_SETTINGS,
  type PushNotificationPayload,
  type PushNotificationSettings,
  type PushServiceWorkerMessage,
  PushServiceWorkerMessageType,
  type PushSubscriptionPayload,
  type PushSubscriptionStatus,
} from "../types/push-notifications";
import { createLogger } from "../utils/logger";

const logger = createLogger("PushNotificationService");

// Local storage keys
const STORAGE_KEYS = {
  PUSH_SETTINGS: "shadowsky:push-settings",
  PUSH_SUBSCRIPTION: "shadowsky:push-subscription",
  PUSH_DISMISSED: "shadowsky:push-dismissed",
} as const;

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * PushNotificationService singleton
 */
class PushNotificationService {
  private static instance: PushNotificationService;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private settings: PushNotificationSettings = DEFAULT_PUSH_SETTINGS;
  private messageHandlers: Map<string, Set<(payload: unknown) => void>> =
    new Map();
  private initialized = false;

  private constructor() {
    // Load settings from storage
    this.loadSettings();
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize the push notification service
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.isSupported()) {
      logger.warn("Push notifications are not supported in this browser");
      return;
    }

    try {
      // Wait for service worker registration
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;

      // Get existing subscription
      this.subscription =
        await this.serviceWorkerRegistration.pushManager.getSubscription();

      // Set up message listener
      navigator.serviceWorker.addEventListener(
        "message",
        this.handleServiceWorkerMessage.bind(this),
      );

      // Send settings to service worker
      await this.syncSettingsToServiceWorker();

      this.initialized = true;
      logger.info("Push notification service initialized", {
        hasSubscription: !!this.subscription,
      });
    } catch (error) {
      logger.error("Failed to initialize push notification service:", error);
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  /**
   * Get current push subscription status
   */
  async getStatus(): Promise<PushSubscriptionStatus> {
    if (!this.isSupported()) {
      return {
        isSupported: false,
        permission: "unsupported",
        isSubscribed: false,
        subscription: null,
      };
    }

    const permission = Notification.permission as
      | "prompt"
      | "granted"
      | "denied";

    return {
      isSupported: true,
      permission: permission === "default" ? "prompt" : permission,
      isSubscribed: !!this.subscription,
      subscription: this.subscription,
    };
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error("Push notifications are not supported");
    }

    const permission = await Notification.requestPermission();
    logger.info("Notification permission:", permission);
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      throw new Error("Push notifications are not supported");
    }

    // Ensure we have permission
    const permission = await this.requestPermission();
    if (permission !== "granted") {
      logger.warn("Notification permission denied");
      return null;
    }

    // Ensure service worker is ready
    if (!this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
    }

    // Get VAPID public key from environment
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      logger.warn(
        "VAPID public key not configured, using local notifications only",
      );
      // Still mark as "subscribed" for local notifications
      this.subscription = null;
      this.settings.enabled = true;
      this.saveSettings();
      return null;
    }

    try {
      // Subscribe to push manager
      const subscription =
        await this.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

      this.subscription = subscription;

      // Save subscription locally
      this.saveSubscription(subscription);

      // Enable settings
      this.settings.enabled = true;
      this.saveSettings();

      logger.info("Push subscription created successfully");

      return subscription;
    } catch (error) {
      logger.error("Failed to subscribe to push notifications:", error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      await this.subscription.unsubscribe();
      this.subscription = null;

      // Remove from local storage
      localStorage.removeItem(STORAGE_KEYS.PUSH_SUBSCRIPTION);

      // Disable settings
      this.settings.enabled = false;
      this.saveSettings();

      logger.info("Push subscription removed");
      return true;
    } catch (error) {
      logger.error("Failed to unsubscribe from push notifications:", error);
      return false;
    }
  }

  /**
   * Get push subscription payload for server
   */
  getSubscriptionPayload(): PushSubscriptionPayload | null {
    if (!this.subscription) {
      return null;
    }

    const json = this.subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return null;
    }

    return {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      expirationTime: this.subscription.expirationTime,
      userAgent: navigator.userAgent,
      createdAt: Date.now(),
    };
  }

  /**
   * Show a local notification (for testing or when no server push)
   */
  async showLocalNotification(payload: PushNotificationPayload): Promise<void> {
    if (!this.isSupported()) {
      throw new Error("Notifications are not supported");
    }

    if (Notification.permission !== "granted") {
      throw new Error("Notification permission not granted");
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      logger.info("Skipping notification during quiet hours");
      return;
    }

    // Check notification type settings
    if (!this.shouldShowNotification(payload)) {
      logger.info("Notification type disabled in settings");
      return;
    }

    if (!this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
    }

    const {
      title = "ShadowSky",
      body = "You have a new notification",
      icon = "/butterfly-icon.svg",
      badge = "/butterfly-icon.svg",
      tag,
      data,
      actions,
      requireInteraction = false,
      silent = false,
    } = payload;

    const options: NotificationOptions = {
      body,
      icon,
      badge,
      tag: tag || `local-${Date.now()}`,
      data,
      requireInteraction,
      silent: silent || !this.settings.soundEnabled,
    };

    if (actions) {
      options.actions = actions;
    }

    if (this.settings.vibrationEnabled) {
      options.vibrate = [200, 100, 200];
    }

    await this.serviceWorkerRegistration.showNotification(title, options);
  }

  /**
   * Check if notification should be shown based on settings
   */
  private shouldShowNotification(payload: PushNotificationPayload): boolean {
    if (!this.settings.enabled) {
      return false;
    }

    const reason = payload.data?.reason;
    if (!reason) {
      return true;
    }

    switch (reason) {
      case "like":
        return this.settings.likes;
      case "repost":
        return this.settings.reposts;
      case "follow":
        return this.settings.follows;
      case "mention":
        return this.settings.mentions;
      case "reply":
        return this.settings.replies;
      case "quote":
        return this.settings.quotes;
      default:
        return true;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.settings.quietHoursEnabled) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.settings.quietHoursStart
      .split(":")
      .map(Number);
    const [endHour, endMin] = this.settings.quietHoursEnd
      .split(":")
      .map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Clear all notifications
   */
  async clearNotifications(tag?: string): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      return;
    }

    const notifications = await this.serviceWorkerRegistration.getNotifications(
      tag ? { tag } : undefined,
    );

    notifications.forEach((notification) => notification.close());
  }

  /**
   * Get current settings
   */
  getSettings(): PushNotificationSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(
    settings: Partial<PushNotificationSettings>,
  ): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
    await this.syncSettingsToServiceWorker();
  }

  /**
   * Check if user dismissed the permission prompt
   */
  isDismissed(): boolean {
    return localStorage.getItem(STORAGE_KEYS.PUSH_DISMISSED) === "true";
  }

  /**
   * Set dismissed state
   */
  setDismissed(dismissed: boolean): void {
    if (dismissed) {
      localStorage.setItem(STORAGE_KEYS.PUSH_DISMISSED, "true");
    } else {
      localStorage.removeItem(STORAGE_KEYS.PUSH_DISMISSED);
    }
  }

  /**
   * Register message handler for service worker messages
   */
  onMessage(
    type: PushServiceWorkerMessageType | string,
    handler: (payload: unknown) => void,
  ): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const message = event.data as PushServiceWorkerMessage;
    if (!message?.type) {
      return;
    }

    logger.info("Received service worker message:", message.type);

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }

    // Handle subscription changes
    if (message.type === PushServiceWorkerMessageType.SUBSCRIPTION_CHANGE) {
      this.handleSubscriptionChange(message.payload);
    }
  }

  /**
   * Handle subscription change from service worker
   */
  private handleSubscriptionChange(payload: unknown): void {
    const data = payload as {
      subscription: PushSubscriptionJSON | null;
      action: string;
      error?: string;
    };

    if (data.action === "expired" || !data.subscription) {
      logger.warn("Push subscription expired");
      this.subscription = null;
      localStorage.removeItem(STORAGE_KEYS.PUSH_SUBSCRIPTION);
    }
  }

  /**
   * Load settings from local storage
   */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PUSH_SETTINGS);
      if (stored) {
        this.settings = { ...DEFAULT_PUSH_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error("Failed to load push settings:", error);
    }
  }

  /**
   * Save settings to local storage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PUSH_SETTINGS,
        JSON.stringify(this.settings),
      );
    } catch (error) {
      logger.error("Failed to save push settings:", error);
    }
  }

  /**
   * Save subscription to local storage
   */
  private saveSubscription(subscription: PushSubscription): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PUSH_SUBSCRIPTION,
        JSON.stringify(subscription.toJSON()),
      );
    } catch (error) {
      logger.error("Failed to save push subscription:", error);
    }
  }

  /**
   * Sync settings to service worker
   */
  private async syncSettingsToServiceWorker(): Promise<void> {
    if (!this.serviceWorkerRegistration?.active) {
      return;
    }

    this.serviceWorkerRegistration.active.postMessage({
      type: PushServiceWorkerMessageType.UPDATE_SETTINGS,
      payload: this.settings,
    });
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Export for direct access
export { PushNotificationService };
