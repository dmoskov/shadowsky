/**
 * Adaptive polling utilities for React Query
 *
 * Provides app-state-aware polling intervals that:
 * 1. Stop polling when the app is backgrounded
 * 2. Reduce frequency when Jetstream provides real-time updates
 * 3. Triple intervals when Low Power Mode is enabled
 */

import { useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useJetstreamOptional } from "../contexts/JetstreamContext";
import { useIsScrolling } from "./useScrollState";
import { useLowPowerMode } from "./useLowPowerMode";

/** Multiplier applied to all polling intervals when Low Power Mode is active */
const LOW_POWER_MULTIPLIER = 3;

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
  /** When true, pause polling while the user is actively scrolling a feed */
  pauseWhenScrolling?: boolean;
}

/**
 * Returns an adaptive refetchInterval value based on app state and Jetstream.
 *
 * When the app is backgrounded, returns `false` to stop polling entirely.
 * When Jetstream is connected, uses the longer realtime interval.
 * When Low Power Mode is enabled, triples all intervals.
 * Otherwise uses the standard active interval.
 *
 * Pair with `refetchIntervalInBackground: false` for defense-in-depth.
 */
export function useAdaptivePolling(
  config: AdaptivePollingConfig,
): number | false {
  const isAppActive = useAppStateActive();
  const jetstream = useJetstreamOptional();
  const isScrolling = useIsScrolling();
  const isLowPower = useLowPowerMode();

  if (!isAppActive) {
    return false;
  }

  // Pause polling during active feed scrolling to avoid wasting
  // API calls and rate limiter tokens (see ISSUE-NET-1).
  // Polling resumes automatically after scroll settles (5s debounce).
  if (config.pauseWhenScrolling && isScrolling) {
    return false;
  }

  const base = jetstream?.isConnected
    ? config.activeRealtimeInterval
    : config.activeInterval;

  return isLowPower ? base * LOW_POWER_MULTIPLIER : base;
}
