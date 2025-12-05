/**
 * Network Information API utility for adaptive image prefetching
 *
 * Uses the Network Information API to detect connection quality and adjust
 * prefetching behavior accordingly. Falls back gracefully on unsupported browsers.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

import { createLogger } from "./logger";

const logger = createLogger("NetworkInfo");

/**
 * Connection effective types from Network Information API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType
 */
export type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g";

/**
 * Connection types from Network Information API
 */
export type ConnectionType =
  | "bluetooth"
  | "cellular"
  | "ethernet"
  | "none"
  | "wifi"
  | "wimax"
  | "other"
  | "unknown";

/**
 * Network quality levels for prefetch strategy decisions
 */
export type NetworkQuality = "excellent" | "good" | "moderate" | "poor" | "offline";

/**
 * Prefetch strategy configuration based on network quality
 */
export interface PrefetchStrategy {
  /** Whether to prefetch images at all */
  enabled: boolean;
  /** Maximum number of concurrent image loads */
  maxConcurrentLoads: number;
  /** Viewport margin multiplier for IntersectionObserver (as percentage) */
  rootMarginPercent: number;
  /** Whether to prefetch low-quality placeholders only */
  lowQualityOnly: boolean;
  /** Delay between batch loads in milliseconds */
  batchDelayMs: number;
  /** Image quality to request (if supported by CDN) */
  imageQuality: "low" | "medium" | "high";
}

/**
 * Network information snapshot
 */
export interface NetworkInfoSnapshot {
  /** Whether the Network Information API is supported */
  isSupported: boolean;
  /** Whether the device is online */
  isOnline: boolean;
  /** Effective connection type (2g, 3g, 4g, slow-2g) */
  effectiveType: EffectiveConnectionType | null;
  /** Connection type (wifi, cellular, etc.) */
  connectionType: ConnectionType | null;
  /** Estimated downlink speed in Mbps */
  downlink: number | null;
  /** Estimated round-trip time in milliseconds */
  rtt: number | null;
  /** Whether data saver mode is enabled */
  saveData: boolean;
  /** Derived network quality level */
  quality: NetworkQuality;
  /** Recommended prefetch strategy */
  prefetchStrategy: PrefetchStrategy;
}

// TypeScript declarations for Network Information API
interface NetworkInformation extends EventTarget {
  readonly effectiveType?: EffectiveConnectionType;
  readonly type?: ConnectionType;
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
  onchange?: ((this: NetworkInformation, ev: Event) => unknown) | null;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

/**
 * Get the NetworkInformation object if available
 */
function getNetworkConnection(): NetworkInformation | undefined {
  const nav = navigator as NavigatorWithConnection;
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

/**
 * Check if the Network Information API is supported
 */
export function isNetworkInfoSupported(): boolean {
  return getNetworkConnection() !== undefined;
}

/**
 * Determine network quality based on available metrics
 */
function determineNetworkQuality(
  effectiveType: EffectiveConnectionType | null,
  downlink: number | null,
  rtt: number | null,
  saveData: boolean,
  isOnline: boolean,
): NetworkQuality {
  if (!isOnline) {
    return "offline";
  }

  // If user has data saver enabled, treat as poor connection
  if (saveData) {
    return "poor";
  }

  // Use effective type as primary indicator
  if (effectiveType) {
    switch (effectiveType) {
      case "4g":
        // Further differentiate 4g based on downlink speed
        if (downlink !== null && downlink >= 10) {
          return "excellent";
        }
        return "good";
      case "3g":
        return "moderate";
      case "2g":
      case "slow-2g":
        return "poor";
    }
  }

  // Fallback to downlink/RTT if effective type not available
  if (downlink !== null) {
    if (downlink >= 10) return "excellent";
    if (downlink >= 2) return "good";
    if (downlink >= 0.5) return "moderate";
    return "poor";
  }

  if (rtt !== null) {
    if (rtt < 50) return "excellent";
    if (rtt < 150) return "good";
    if (rtt < 400) return "moderate";
    return "poor";
  }

  // Default to good if we can't determine (assume modern connection)
  return "good";
}

/**
 * Get prefetch strategy based on network quality
 */
function getPrefetchStrategy(quality: NetworkQuality, isMobile: boolean): PrefetchStrategy {
  const baseMaxLoads = isMobile ? 6 : 12;

  switch (quality) {
    case "excellent":
      return {
        enabled: true,
        maxConcurrentLoads: baseMaxLoads,
        rootMarginPercent: isMobile ? 500 : 800,
        lowQualityOnly: false,
        batchDelayMs: 50,
        imageQuality: "high",
      };
    case "good":
      return {
        enabled: true,
        maxConcurrentLoads: Math.ceil(baseMaxLoads * 0.75),
        rootMarginPercent: isMobile ? 400 : 600,
        lowQualityOnly: false,
        batchDelayMs: 100,
        imageQuality: "high",
      };
    case "moderate":
      return {
        enabled: true,
        maxConcurrentLoads: Math.ceil(baseMaxLoads * 0.5),
        rootMarginPercent: isMobile ? 200 : 300,
        lowQualityOnly: false,
        batchDelayMs: 200,
        imageQuality: "medium",
      };
    case "poor":
      return {
        enabled: true,
        maxConcurrentLoads: 2,
        rootMarginPercent: 100,
        lowQualityOnly: true,
        batchDelayMs: 500,
        imageQuality: "low",
      };
    case "offline":
      return {
        enabled: false,
        maxConcurrentLoads: 0,
        rootMarginPercent: 0,
        lowQualityOnly: true,
        batchDelayMs: 0,
        imageQuality: "low",
      };
  }
}

/**
 * Get current network information snapshot
 */
export function getNetworkInfo(): NetworkInfoSnapshot {
  const connection = getNetworkConnection();
  const isOnline = navigator.onLine;
  const isMobile = window.innerWidth < 768;

  const effectiveType = (connection?.effectiveType as EffectiveConnectionType) || null;
  const connectionType = (connection?.type as ConnectionType) || null;
  const downlink = connection?.downlink ?? null;
  const rtt = connection?.rtt ?? null;
  const saveData = connection?.saveData ?? false;

  const quality = determineNetworkQuality(effectiveType, downlink, rtt, saveData, isOnline);
  const prefetchStrategy = getPrefetchStrategy(quality, isMobile);

  return {
    isSupported: connection !== undefined,
    isOnline,
    effectiveType,
    connectionType,
    downlink,
    rtt,
    saveData,
    quality,
    prefetchStrategy,
  };
}

/**
 * Callback type for network change events
 */
export type NetworkChangeCallback = (info: NetworkInfoSnapshot) => void;

/**
 * Subscribe to network information changes
 * Returns an unsubscribe function
 */
export function subscribeToNetworkChanges(callback: NetworkChangeCallback): () => void {
  const connection = getNetworkConnection();
  const listeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];

  // Initial callback with current state
  callback(getNetworkInfo());

  // Connection change listener (for supported browsers)
  if (connection) {
    const connectionHandler = () => {
      const info = getNetworkInfo();
      logger.log("Network connection changed:", info.quality, info.effectiveType);
      callback(info);
    };
    connection.addEventListener("change", connectionHandler);
    listeners.push({ target: connection, type: "change", handler: connectionHandler });
  }

  // Online/offline listeners (universal fallback)
  const onlineHandler = () => {
    logger.log("Network online");
    callback(getNetworkInfo());
  };
  const offlineHandler = () => {
    logger.log("Network offline");
    callback(getNetworkInfo());
  };

  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
  listeners.push({ target: window, type: "online", handler: onlineHandler });
  listeners.push({ target: window, type: "offline", handler: offlineHandler });

  // Return unsubscribe function
  return () => {
    listeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
  };
}

/**
 * Check if we should reduce data usage based on network conditions
 */
export function shouldReduceDataUsage(): boolean {
  const info = getNetworkInfo();
  return info.quality === "poor" || info.quality === "offline" || info.saveData;
}

/**
 * Get recommended image quality based on network conditions
 */
export function getRecommendedImageQuality(): "low" | "medium" | "high" {
  return getNetworkInfo().prefetchStrategy.imageQuality;
}

/**
 * Check if prefetching should be enabled based on network conditions
 */
export function isPrefetchingEnabled(): boolean {
  return getNetworkInfo().prefetchStrategy.enabled;
}
