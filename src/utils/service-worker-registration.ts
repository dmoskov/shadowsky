/**
 * Service Worker Registration Utility
 *
 * Handles PWA service worker registration, updates, and lifecycle events.
 * Uses Workbox for caching strategies with stale-while-revalidate for static assets.
 *
 * Features:
 * - Manual registration with update prompts
 * - Cache size monitoring (50MB limit)
 * - Graceful update handling
 * - Event callbacks for UI integration
 */

import { createLogger } from "./logger";

const logger = createLogger("ServiceWorker");

// Cache size limit: 50MB
const CACHE_SIZE_LIMIT = 50 * 1024 * 1024;

export interface ServiceWorkerCallbacks {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
}

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Check if service workers are supported in this browser
 */
export function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator;
}

/**
 * Register the service worker with lifecycle event handling
 */
export async function registerServiceWorker(
  callbacks: ServiceWorkerCallbacks = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    logger.info("Service workers are not supported in this browser");
    return null;
  }

  try {
    // Import workbox-window for registration handling
    const { Workbox } = await import("workbox-window");

    const wb = new Workbox("/sw.js", {
      scope: "/",
    });

    // Handle waiting service worker (update available)
    wb.addEventListener("waiting", () => {
      logger.info("New service worker waiting to activate");

      // Get the registration for update callback
      wb.getSW().then((sw) => {
        if (sw && sw.state === "installed") {
          const reg = swRegistration;
          if (reg && callbacks.onUpdate) {
            callbacks.onUpdate(reg);
          }
        }
      });
    });

    // Handle successful installation
    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate) {
        logger.info("Service worker installed for the first time");
        callbacks.onOfflineReady?.();
      }
    });

    // Handle activation
    wb.addEventListener("activated", (event) => {
      if (event.isUpdate) {
        logger.info("Service worker updated and activated");
      } else {
        logger.info("Service worker activated");
      }
    });

    // Handle controlling
    wb.addEventListener("controlling", () => {
      logger.info("Service worker is now controlling the page");
    });

    // Handle redundant (failed) service worker
    wb.addEventListener("redundant", () => {
      logger.warn("Service worker became redundant");
    });

    // Register the service worker
    const registration = await wb.register();
    swRegistration = registration ?? null;

    if (registration) {
      logger.info("Service worker registered successfully");
      callbacks.onSuccess?.(registration);

      // Check for updates periodically (every hour)
      setInterval(
        () => {
          registration.update().catch((err) => {
            logger.warn("Failed to check for service worker updates:", err);
          });
        },
        60 * 60 * 1000,
      );
    }

    return registration ?? null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Service worker registration failed:", err);
    callbacks.onError?.(err);
    return null;
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    logger.info("All service workers unregistered");
    swRegistration = null;
    return true;
  } catch (error) {
    logger.error("Failed to unregister service workers:", error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export async function skipWaiting(): Promise<void> {
  if (!swRegistration?.waiting) {
    logger.warn("No waiting service worker to activate");
    return;
  }

  // Tell the waiting service worker to skip waiting
  swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });

  // Reload the page to get the new version
  window.location.reload();
}

/**
 * Get current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Check if there's an update available
 */
export function isUpdateAvailable(): boolean {
  return (
    swRegistration?.waiting !== null && swRegistration?.waiting !== undefined
  );
}

/**
 * Manually check for service worker updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!swRegistration) {
    logger.warn("No service worker registration to update");
    return;
  }

  try {
    await swRegistration.update();
    logger.info("Checked for service worker updates");
  } catch (error) {
    logger.error("Failed to check for updates:", error);
  }
}

/**
 * Get estimated cache storage usage
 */
export async function getCacheStorageUsage(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (!("storage" in navigator) || !("estimate" in navigator.storage)) {
    return { usage: 0, quota: 0, percentUsed: 0 };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentUsed };
  } catch (error) {
    logger.error("Failed to get storage estimate:", error);
    return { usage: 0, quota: 0, percentUsed: 0 };
  }
}

/**
 * Check if cache storage exceeds limit
 */
export async function isCacheOverLimit(): Promise<boolean> {
  const { usage } = await getCacheStorageUsage();
  return usage > CACHE_SIZE_LIMIT;
}

/**
 * Clear all caches (emergency cleanup)
 */
export async function clearAllCaches(): Promise<boolean> {
  if (!("caches" in window)) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    logger.info("All caches cleared");
    return true;
  } catch (error) {
    logger.error("Failed to clear caches:", error);
    return false;
  }
}

/**
 * Get list of all cache names and their sizes
 */
export async function getCacheInfo(): Promise<
  Array<{ name: string; entries: number }>
> {
  if (!("caches" in window)) {
    return [];
  }

  try {
    const cacheNames = await caches.keys();
    const cacheInfo = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return { name, entries: keys.length };
      }),
    );
    return cacheInfo;
  } catch (error) {
    logger.error("Failed to get cache info:", error);
    return [];
  }
}

/**
 * Get the current service worker state
 */
export function getServiceWorkerState(): ServiceWorkerState {
  return {
    isSupported: isServiceWorkerSupported(),
    isRegistered: swRegistration !== null,
    isUpdateAvailable: isUpdateAvailable(),
    registration: swRegistration,
  };
}
