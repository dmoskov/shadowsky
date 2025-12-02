/**
 * React hook for service worker integration
 *
 * Provides:
 * - Registration status
 * - Update availability detection
 * - Update application function
 * - Cache storage info
 */

import { useCallback, useEffect, useState } from "react";
import {
  checkForUpdates,
  clearAllCaches,
  getCacheStorageUsage,
  getServiceWorkerState,
  isServiceWorkerSupported,
  registerServiceWorker,
  ServiceWorkerState,
  skipWaiting,
  unregisterServiceWorker,
} from "../utils/service-worker-registration";

export interface UseServiceWorkerReturn {
  /**
   * Current service worker state
   */
  state: ServiceWorkerState;

  /**
   * Whether service workers are supported
   */
  isSupported: boolean;

  /**
   * Whether the service worker is registered and active
   */
  isReady: boolean;

  /**
   * Whether an update is available
   */
  hasUpdate: boolean;

  /**
   * Whether offline mode is ready (first install complete)
   */
  isOfflineReady: boolean;

  /**
   * Any error that occurred during registration
   */
  error: Error | null;

  /**
   * Cache storage usage info
   */
  cacheUsage: {
    usage: number;
    quota: number;
    percentUsed: number;
  } | null;

  /**
   * Apply the available update (reloads the page)
   */
  applyUpdate: () => Promise<void>;

  /**
   * Manually check for updates
   */
  checkForUpdates: () => Promise<void>;

  /**
   * Clear all caches
   */
  clearCaches: () => Promise<boolean>;

  /**
   * Unregister the service worker
   */
  unregister: () => Promise<boolean>;

  /**
   * Refresh cache usage info
   */
  refreshCacheUsage: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>(getServiceWorkerState);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cacheUsage, setCacheUsage] = useState<{
    usage: number;
    quota: number;
    percentUsed: number;
  } | null>(null);

  // Refresh cache usage info
  const refreshCacheUsage = useCallback(async () => {
    const usage = await getCacheStorageUsage();
    setCacheUsage(usage);
  }, []);

  // Register service worker on mount
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      return;
    }

    // Only register in production
    if (import.meta.env.DEV) {
      return;
    }

    registerServiceWorker({
      onSuccess: () => {
        setState(getServiceWorkerState());
        refreshCacheUsage();
      },
      onUpdate: () => {
        setState(getServiceWorkerState());
      },
      onOfflineReady: () => {
        setIsOfflineReady(true);
      },
      onError: (err) => {
        setError(err);
      },
    });
  }, [refreshCacheUsage]);

  // Poll for state changes
  useEffect(() => {
    if (!isServiceWorkerSupported() || import.meta.env.DEV) {
      return;
    }

    const interval = setInterval(() => {
      setState(getServiceWorkerState());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const applyUpdate = useCallback(async () => {
    await skipWaiting();
  }, []);

  const checkUpdates = useCallback(async () => {
    await checkForUpdates();
    setState(getServiceWorkerState());
  }, []);

  const clearCaches = useCallback(async () => {
    const result = await clearAllCaches();
    await refreshCacheUsage();
    return result;
  }, [refreshCacheUsage]);

  const unregister = useCallback(async () => {
    const result = await unregisterServiceWorker();
    setState(getServiceWorkerState());
    return result;
  }, []);

  return {
    state,
    isSupported: state.isSupported,
    isReady: state.isRegistered,
    hasUpdate: state.isUpdateAvailable,
    isOfflineReady,
    error,
    cacheUsage,
    applyUpdate,
    checkForUpdates: checkUpdates,
    clearCaches,
    unregister,
    refreshCacheUsage,
  };
}
