/**
 * Background Sync Service
 *
 * Implements background timeline refresh for PWA using:
 * - Periodic Background Sync API (for scheduled background updates)
 * - Background Sync API (for retry on reconnection)
 *
 * This is the PWA equivalent of:
 * - iOS: BGAppRefreshTask
 * - Android: WorkManager
 *
 * Features:
 * - Periodic timeline refresh when app is in background
 * - Respects user data/battery preferences
 * - Caches fresh content for instant display on app open
 * - Updates badge count from background
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("BackgroundSyncService");

// Sync tag constants
export const SYNC_TAGS = {
  TIMELINE_REFRESH: "timeline-refresh",
  NOTIFICATION_SYNC: "notification-sync",
  DM_SYNC: "dm-sync",
} as const;

export type SyncTag = (typeof SYNC_TAGS)[keyof typeof SYNC_TAGS];

// Background sync intervals (in milliseconds)
export const SYNC_INTERVALS = {
  // Minimum interval for periodic sync (browser enforced, typically 12 hours minimum)
  MIN_PERIODIC_INTERVAL_MS: 12 * 60 * 60 * 1000,
  // Preferred interval for timeline refresh (15 minutes)
  PREFERRED_INTERVAL_MS: 15 * 60 * 1000,
  // High frequency for engaged users (5 minutes)
  HIGH_FREQUENCY_MS: 5 * 60 * 1000,
  // Low frequency for battery saving (30 minutes)
  LOW_FREQUENCY_MS: 30 * 60 * 1000,
} as const;

/**
 * Background refresh preferences stored by user
 */
export interface BackgroundRefreshPreferences {
  /** Enable/disable background refresh entirely */
  enabled: boolean;
  /** Refresh frequency preference */
  frequency: "high" | "normal" | "low";
  /** Which content types to refresh */
  contentTypes: {
    timeline: boolean;
    notifications: boolean;
    directMessages: boolean;
  };
  /** Battery/data saving mode */
  dataSaverMode: boolean;
  /** Only sync on WiFi */
  wifiOnly: boolean;
}

/**
 * Default preferences for background refresh
 */
export const DEFAULT_BACKGROUND_PREFERENCES: BackgroundRefreshPreferences = {
  enabled: true,
  frequency: "normal",
  contentTypes: {
    timeline: true,
    notifications: true,
    directMessages: false, // DMs disabled by default for privacy
  },
  dataSaverMode: false,
  wifiOnly: false,
};

/**
 * Background sync status
 */
export interface BackgroundSyncStatus {
  /** Whether periodic background sync is supported */
  isSupported: boolean;
  /** Whether periodic sync is currently registered */
  isRegistered: boolean;
  /** Permission status for periodic sync */
  permissionStatus: PermissionState | "unsupported";
  /** Last successful sync timestamp */
  lastSyncAt: number | null;
  /** Last sync error if any */
  lastError: string | null;
  /** Current preferences */
  preferences: BackgroundRefreshPreferences;
}

/**
 * Result of a background sync operation
 */
export interface SyncResult {
  success: boolean;
  syncTag: SyncTag;
  timestamp: number;
  itemsFetched: number;
  error?: string;
}

// LocalStorage keys for background sync state
const STORAGE_KEYS = {
  PREFERENCES: "shadowsky_background_sync_preferences",
  LAST_SYNC: "shadowsky_background_sync_last",
  LAST_ERROR: "shadowsky_background_sync_error",
} as const;

class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private isInitialized = false;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Initialize the background sync service
   */
  async init(registration: ServiceWorkerRegistration): Promise<void> {
    if (this.isInitialized) return;

    this.registration = registration;
    this.isInitialized = true;

    // Check and register periodic sync if supported
    const preferences = this.getPreferences();
    if (preferences.enabled) {
      await this.registerPeriodicSync();
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", this.handleSWMessage);

    logger.info("Background sync service initialized");
  }

  /**
   * Handle messages from the service worker
   */
  private handleSWMessage = (event: MessageEvent): void => {
    const { type, payload } = event.data || {};

    switch (type) {
      case "background-sync:completed":
        this.handleSyncCompleted(payload);
        break;
      case "background-sync:error":
        this.handleSyncError(payload);
        break;
      case "background-sync:badge-update":
        this.updateBadgeCount(payload.count);
        break;
    }
  };

  /**
   * Handle completed sync from service worker
   */
  private handleSyncCompleted(result: SyncResult): void {
    logger.info("Background sync completed:", result);
    this.setLastSyncTimestamp(result.timestamp);
    this.clearLastError();

    // Dispatch event for UI to handle
    window.dispatchEvent(
      new CustomEvent("backgroundSyncCompleted", { detail: result }),
    );
  }

  /**
   * Handle sync error from service worker
   */
  private handleSyncError(error: { syncTag: SyncTag; message: string }): void {
    logger.error("Background sync error:", error);
    this.setLastError(error.message);

    // Dispatch event for UI to handle
    window.dispatchEvent(
      new CustomEvent("backgroundSyncError", { detail: error }),
    );
  }

  /**
   * Check if periodic background sync is supported
   */
  isPeriodicSyncSupported(): boolean {
    return (
      "serviceWorker" in navigator &&
      "periodicSync" in ServiceWorkerRegistration.prototype
    );
  }

  /**
   * Check if basic background sync is supported
   */
  isBackgroundSyncSupported(): boolean {
    return (
      "serviceWorker" in navigator &&
      "sync" in ServiceWorkerRegistration.prototype
    );
  }

  /**
   * Get the permission status for periodic background sync
   */
  async getPeriodicSyncPermission(): Promise<PermissionState | "unsupported"> {
    if (!this.isPeriodicSyncSupported()) {
      return "unsupported";
    }

    try {
      const status = await navigator.permissions.query({
        name: "periodic-background-sync" as PermissionName,
      });
      return status.state;
    } catch {
      return "unsupported";
    }
  }

  /**
   * Register for periodic background sync
   */
  async registerPeriodicSync(): Promise<boolean> {
    if (!this.registration) {
      logger.warn("No service worker registration available");
      return false;
    }

    // Check if periodic sync is supported
    if (!this.isPeriodicSyncSupported()) {
      logger.info(
        "Periodic background sync not supported, falling back to basic sync",
      );
      return this.registerBasicSync();
    }

    // Check permission
    const permission = await this.getPeriodicSyncPermission();
    if (permission !== "granted") {
      logger.info(`Periodic sync permission: ${permission}`);
      // Still register basic sync as fallback
      return this.registerBasicSync();
    }

    const preferences = this.getPreferences();
    const interval = this.getIntervalForFrequency(preferences.frequency);

    try {
      // TypeScript doesn't have full types for periodicSync yet
      const periodicSync = (this.registration as any).periodicSync;

      if (periodicSync) {
        // Register timeline refresh
        if (preferences.contentTypes.timeline) {
          await periodicSync.register(SYNC_TAGS.TIMELINE_REFRESH, {
            minInterval: interval,
          });
          logger.info(
            `Registered periodic sync for timeline (interval: ${interval}ms)`,
          );
        }

        // Register notification sync
        if (preferences.contentTypes.notifications) {
          await periodicSync.register(SYNC_TAGS.NOTIFICATION_SYNC, {
            minInterval: interval,
          });
          logger.info("Registered periodic sync for notifications");
        }

        // Register DM sync if enabled
        if (preferences.contentTypes.directMessages) {
          await periodicSync.register(SYNC_TAGS.DM_SYNC, {
            minInterval: interval,
          });
          logger.info("Registered periodic sync for DMs");
        }

        return true;
      }
    } catch (error) {
      logger.error("Failed to register periodic sync:", error);
    }

    // Fall back to basic sync
    return this.registerBasicSync();
  }

  /**
   * Register for basic background sync (retry on reconnection)
   */
  async registerBasicSync(): Promise<boolean> {
    if (!this.registration || !this.isBackgroundSyncSupported()) {
      return false;
    }

    try {
      // TypeScript doesn't have full types for sync yet
      const sync = (this.registration as any).sync;

      if (sync) {
        const preferences = this.getPreferences();

        if (preferences.contentTypes.timeline) {
          await sync.register(SYNC_TAGS.TIMELINE_REFRESH);
          logger.info("Registered basic sync for timeline refresh");
        }

        if (preferences.contentTypes.notifications) {
          await sync.register(SYNC_TAGS.NOTIFICATION_SYNC);
          logger.info("Registered basic sync for notifications");
        }

        return true;
      }
    } catch (error) {
      logger.error("Failed to register basic sync:", error);
    }

    return false;
  }

  /**
   * Unregister periodic sync
   */
  async unregisterPeriodicSync(): Promise<void> {
    if (!this.registration || !this.isPeriodicSyncSupported()) {
      return;
    }

    try {
      const periodicSync = (this.registration as any).periodicSync;

      if (periodicSync) {
        // Unregister all sync tags
        for (const tag of Object.values(SYNC_TAGS)) {
          try {
            await periodicSync.unregister(tag);
            logger.info(`Unregistered periodic sync: ${tag}`);
          } catch {
            // Ignore errors for tags that weren't registered
          }
        }
      }
    } catch (error) {
      logger.error("Failed to unregister periodic sync:", error);
    }
  }

  /**
   * Get interval based on frequency preference
   */
  private getIntervalForFrequency(
    frequency: BackgroundRefreshPreferences["frequency"],
  ): number {
    switch (frequency) {
      case "high":
        return SYNC_INTERVALS.HIGH_FREQUENCY_MS;
      case "low":
        return SYNC_INTERVALS.LOW_FREQUENCY_MS;
      case "normal":
      default:
        return SYNC_INTERVALS.PREFERRED_INTERVAL_MS;
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): BackgroundRefreshPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        return { ...DEFAULT_BACKGROUND_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error("Failed to load background sync preferences:", error);
    }
    return DEFAULT_BACKGROUND_PREFERENCES;
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    updates: Partial<BackgroundRefreshPreferences>,
  ): Promise<void> {
    const current = this.getPreferences();
    const updated = { ...current, ...updates };

    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
      logger.info("Updated background sync preferences:", updated);

      // Re-register syncs with new settings
      if (updated.enabled) {
        await this.unregisterPeriodicSync();
        await this.registerPeriodicSync();
      } else {
        await this.unregisterPeriodicSync();
      }

      // Notify service worker of preference change
      this.postToServiceWorker({
        type: "background-sync:preferences-updated",
        payload: updated,
      });
    } catch (error) {
      logger.error("Failed to update background sync preferences:", error);
    }
  }

  /**
   * Get the current status of background sync
   */
  async getStatus(): Promise<BackgroundSyncStatus> {
    const preferences = this.getPreferences();
    const permission = await this.getPeriodicSyncPermission();
    const isRegistered = await this.checkIfRegistered();

    return {
      isSupported: this.isPeriodicSyncSupported(),
      isRegistered,
      permissionStatus: permission,
      lastSyncAt: this.getLastSyncTimestamp(),
      lastError: this.getLastError(),
      preferences,
    };
  }

  /**
   * Check if periodic sync is currently registered
   */
  private async checkIfRegistered(): Promise<boolean> {
    if (!this.registration || !this.isPeriodicSyncSupported()) {
      return false;
    }

    try {
      const periodicSync = (this.registration as any).periodicSync;
      if (periodicSync) {
        const tags = await periodicSync.getTags();
        return tags.includes(SYNC_TAGS.TIMELINE_REFRESH);
      }
    } catch {
      // Ignore errors
    }

    return false;
  }

  /**
   * Trigger an immediate sync (for manual refresh)
   */
  async triggerImmediateSync(
    tag: SyncTag = SYNC_TAGS.TIMELINE_REFRESH,
  ): Promise<void> {
    if (!this.registration) {
      logger.warn("No service worker registration available");
      return;
    }

    // Post message to service worker to trigger sync
    this.postToServiceWorker({
      type: "background-sync:trigger",
      payload: { tag },
    });

    logger.info(`Triggered immediate sync: ${tag}`);
  }

  /**
   * Update the app badge count
   */
  private async updateBadgeCount(count: number): Promise<void> {
    if ("setAppBadge" in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
        logger.info(`Updated badge count: ${count}`);
      } catch (error) {
        logger.error("Failed to update badge count:", error);
      }
    }
  }

  /**
   * Clear the app badge
   */
  async clearBadge(): Promise<void> {
    if ("clearAppBadge" in navigator) {
      try {
        await (navigator as any).clearAppBadge();
        logger.info("Cleared badge count");
      } catch (error) {
        logger.error("Failed to clear badge:", error);
      }
    }
  }

  /**
   * Post message to service worker
   */
  private postToServiceWorker(message: {
    type: string;
    payload?: unknown;
  }): void {
    if (this.registration?.active) {
      this.registration.active.postMessage(message);
    }
  }

  /**
   * Get last sync timestamp
   */
  private getLastSyncTimestamp(): number | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set last sync timestamp
   */
  private setLastSyncTimestamp(timestamp: number): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(timestamp));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get last error
   */
  private getLastError(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_ERROR);
    } catch {
      return null;
    }
  }

  /**
   * Set last error
   */
  private setLastError(error: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_ERROR, error);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clear last error
   */
  private clearLastError(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.LAST_ERROR);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Check if we should sync based on current conditions
   */
  shouldSync(): boolean {
    const preferences = this.getPreferences();

    if (!preferences.enabled) {
      return false;
    }

    // Check WiFi-only preference
    if (preferences.wifiOnly && !this.isOnWifi()) {
      logger.info("Skipping sync: WiFi-only mode and not on WiFi");
      return false;
    }

    // Check data saver mode and connection type
    if (preferences.dataSaverMode && this.isOnSlowConnection()) {
      logger.info("Skipping sync: Data saver mode and slow connection");
      return false;
    }

    return true;
  }

  /**
   * Check if device is on WiFi (best effort detection)
   */
  private isOnWifi(): boolean {
    const connection = (navigator as any).connection;
    if (connection) {
      return connection.type === "wifi";
    }
    // Assume WiFi if we can't detect
    return true;
  }

  /**
   * Check if device is on a slow connection
   */
  private isOnSlowConnection(): boolean {
    const connection = (navigator as any).connection;
    if (connection) {
      // Check effective connection type
      const effectiveType = connection.effectiveType;
      return effectiveType === "slow-2g" || effectiveType === "2g";
    }
    return false;
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    navigator.serviceWorker.removeEventListener(
      "message",
      this.handleSWMessage,
    );
    this.isInitialized = false;
    this.registration = null;
  }
}

export const backgroundSyncService = BackgroundSyncService.getInstance();
