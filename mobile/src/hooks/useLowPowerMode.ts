/**
 * Hook to detect iOS Low Power Mode
 *
 * Returns true when the user has enabled Low Power Mode in iOS Settings
 * (or when iOS auto-enables it at 20% battery). Various hooks and services
 * check this value to reduce background activity and save battery:
 *
 * - useAdaptivePolling: triples polling intervals
 * - useImagePrefetch: disables prefetching
 * - background-fetch: skips background fetch tasks
 * - JetstreamContext: disconnects WebSocket, falls back to polling
 * - useWidgetSync: reduces widget cache-subscription frequency
 */

import { useState, useEffect } from "react";
import { Platform } from "react-native";
import {
  isLowPowerModeEnabled,
  addLowPowerModeListener,
} from "../../modules/low-power-mode";

export function useLowPowerMode(): boolean {
  const [isLowPower, setIsLowPower] = useState(() => {
    if (Platform.OS !== "ios") return false;
    return isLowPowerModeEnabled();
  });

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const unsubscribe = addLowPowerModeListener(setIsLowPower);
    return unsubscribe;
  }, []);

  return isLowPower;
}
