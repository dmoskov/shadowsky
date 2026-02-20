import { Platform } from "react-native";

let LowPowerModeModule: {
  isLowPowerModeEnabled(): boolean;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
} | null = null;

let EventEmitter: any = null;

try {
  const ExpoModulesCore = require("expo-modules-core");
  LowPowerModeModule = ExpoModulesCore.requireNativeModule("LowPowerMode");
  EventEmitter = ExpoModulesCore.EventEmitter;
} catch {
  // Module not available (web or not built with native modules)
}

const emitter =
  LowPowerModeModule && EventEmitter
    ? new EventEmitter(LowPowerModeModule)
    : null;

/**
 * Returns the current Low Power Mode state.
 * Always returns false on non-iOS platforms.
 */
export function isLowPowerModeEnabled(): boolean {
  if (Platform.OS !== "ios" || !LowPowerModeModule) return false;
  try {
    return LowPowerModeModule.isLowPowerModeEnabled();
  } catch {
    return false;
  }
}

/**
 * Subscribe to Low Power Mode state changes.
 * Returns an unsubscribe function.
 */
export function addLowPowerModeListener(
  callback: (isLowPowerMode: boolean) => void,
): () => void {
  if (Platform.OS !== "ios" || !emitter) {
    return () => {};
  }
  const subscription = emitter.addListener(
    "onLowPowerModeChanged",
    (event: { isLowPowerMode: boolean }) => {
      callback(event.isLowPowerMode);
    },
  );
  return () => subscription.remove();
}
