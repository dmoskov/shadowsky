/**
 * Custom hook for monitoring network connectivity status
 *
 * Features:
 * - Monitors real-time network connectivity changes
 * - Detects connection type (wifi, cellular, none)
 * - Assesses network quality (good, poor, offline)
 * - Provides reachability information
 * - Memoized to prevent unnecessary re-renders
 */

import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import { useEffect, useMemo, useRef, useState } from "react";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: "wifi" | "cellular" | "none" | "unknown";
  networkQuality: "good" | "poor" | "offline";
}

/**
 * Derive network quality from connection type and cellular generation
 */
function deriveNetworkQuality(state: NetInfoState): "good" | "poor" | "offline" {
  // Check if connected
  if (!state.isConnected) {
    return "offline";
  }

  // Check if internet is reachable
  if (state.isInternetReachable === false) {
    return "offline";
  }

  // WiFi is generally considered good quality
  if (state.type === NetInfoStateType.wifi) {
    return "good";
  }

  // For cellular, check the generation
  if (state.type === NetInfoStateType.cellular && state.details) {
    const cellularGeneration = (state.details as { cellularGeneration?: string })
      .cellularGeneration;

    if (cellularGeneration) {
      const generation = cellularGeneration.toLowerCase();
      // 2G and 3G are poor quality
      if (generation.includes("2g") || generation.includes("3g")) {
        return "poor";
      }
      // 4G, 5G, and LTE are good quality
      if (
        generation.includes("4g") ||
        generation.includes("5g") ||
        generation.includes("lte")
      ) {
        return "good";
      }
    }

    // Default to good for cellular if we can't determine generation
    return "good";
  }

  // Ethernet and other connection types
  if (state.type === NetInfoStateType.ethernet || state.type === NetInfoStateType.other) {
    return "good";
  }

  // If connected but type is unknown, assume good
  return state.isConnected ? "good" : "offline";
}

/**
 * Map NetInfo connection type to simplified type
 */
function mapConnectionType(
  type: NetInfoStateType,
): "wifi" | "cellular" | "none" | "unknown" {
  switch (type) {
    case NetInfoStateType.wifi:
      return "wifi";
    case NetInfoStateType.cellular:
      return "cellular";
    case NetInfoStateType.none:
      return "none";
    case NetInfoStateType.unknown:
      return "unknown";
    default:
      // Ethernet and other types treated as wifi for simplicity
      return "wifi";
  }
}

/**
 * Hook to monitor network connectivity status
 *
 * @returns NetworkStatus object with current network state
 *
 * @example
 * ```tsx
 * const { isConnected, networkQuality, connectionType } = useNetworkStatus();
 *
 * if (!isConnected) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [netInfoState, setNetInfoState] = useState<NetInfoState | null>(null);
  // Debounce offline transitions to avoid flash on app wake from sleep.
  // Going online is instant; going offline waits to confirm it's real.
  const [debouncedOffline, setDebouncedOffline] = useState(false);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(setNetInfoState);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(setNetInfoState);

    return () => {
      unsubscribe();
    };
  }, []);

  // Debounce offline: wait 3s before reporting offline to avoid
  // the brief "not connected" blip when waking from sleep
  useEffect(() => {
    const isCurrentlyOffline = netInfoState !== null && !netInfoState.isConnected;

    if (isCurrentlyOffline) {
      // Delay reporting offline
      offlineTimerRef.current = setTimeout(() => {
        setDebouncedOffline(true);
      }, 3000);
    } else {
      // Going online is instant — clear any pending offline timer
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      setDebouncedOffline(false);
    }

    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
      }
    };
  }, [netInfoState]);

  // Memoize the network status to prevent unnecessary re-renders
  const networkStatus = useMemo<NetworkStatus>(() => {
    if (!netInfoState) {
      // Default state while loading — assume connected
      return {
        isConnected: true,
        isInternetReachable: null,
        connectionType: "unknown",
        networkQuality: "good",
      };
    }

    // Use debounced offline state instead of raw NetInfo
    const isConnected = debouncedOffline ? false : (netInfoState.isConnected ?? true);

    return {
      isConnected,
      isInternetReachable: isConnected ? netInfoState.isInternetReachable : false,
      connectionType: mapConnectionType(netInfoState.type),
      networkQuality: isConnected ? deriveNetworkQuality(netInfoState) : "offline",
    };
  }, [netInfoState, debouncedOffline]);

  return networkStatus;
}
