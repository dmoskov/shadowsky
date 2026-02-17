/**
 * Adaptive polling utilities for React Query
 *
 * Provides app-state-aware polling intervals that:
 * 1. Stop polling when the app is backgrounded
 * 2. Reduce frequency when Jetstream provides real-time updates
 */

import { useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useJetstreamOptional } from "../contexts/JetstreamContext";

/**
 * Subscribe to AppState and return current state via useSyncExternalStore.
 * This avoids adding a separate AppState listener per hook instance —
 * React deduplicates subscriptions to the same external store.
 */
function useAppStateActive(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const sub = AppState.addEventListener("change", callback);
    return () => sub.remove();
  }, []);

  const getSnapshot = useCallback(() => AppState.currentState === "active", []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface AdaptivePollingConfig {
  /** Interval when app is active and no real-time connection */
  activeInterval: number;
  /** Interval when app is active and Jetstream provides real-time updates */
  activeRealtimeInterval: number;
}

/**
 * Returns an adaptive refetchInterval value based on app state and Jetstream.
 *
 * When the app is backgrounded, returns `false` to stop polling entirely.
 * When Jetstream is connected, uses the longer realtime interval.
 * Otherwise uses the standard active interval.
 *
 * Pair with `refetchIntervalInBackground: false` for defense-in-depth.
 */
export function useAdaptivePolling(config: AdaptivePollingConfig): number | false {
  const isAppActive = useAppStateActive();
  const jetstream = useJetstreamOptional();

  if (!isAppActive) {
    return false;
  }

  if (jetstream?.isConnected) {
    return config.activeRealtimeInterval;
  }

  return config.activeInterval;
}
