import { Platform } from "react-native";
import type { EventSubscription } from "expo-modules-core";

let KeyboardShortcutsNative: {
  addListener(eventName: string, listener: (event: any) => void): EventSubscription;
  removeListeners(count: number): void;
  startObserving?(): void;
  stopObserving?(): void;
} | null = null;

let EventEmitterClass: any = null;

try {
  const expoModulesCore = require("expo-modules-core");
  KeyboardShortcutsNative = expoModulesCore.requireNativeModule("KeyboardShortcuts");
  EventEmitterClass = expoModulesCore.EventEmitter;
} catch {
  // Module not available (web, Android, or not built with native modules)
}

export type KeyCommand =
  | "compose"
  | "search"
  | "tab:home"
  | "tab:search"
  | "tab:feeds"
  | "tab:notifications"
  | "tab:profile"
  | "refresh"
  | "submit";

/**
 * Subscribe to hardware keyboard shortcut events from the native module.
 * Returns a subscription that should be removed on cleanup.
 *
 * On non-iOS platforms or when the native module is unavailable,
 * returns a no-op subscription.
 */
export function addKeyCommandListener(
  callback: (command: KeyCommand) => void,
): EventSubscription {
  if (Platform.OS !== "ios" || !KeyboardShortcutsNative || !EventEmitterClass) {
    // Return a no-op subscription for non-iOS or when module is unavailable
    return { remove: () => {} } as EventSubscription;
  }

  try {
    const emitter = new EventEmitterClass(KeyboardShortcutsNative);
    return emitter.addListener(
      "onKeyCommand",
      (event: { command: KeyCommand }) => {
        callback(event.command);
      },
    );
  } catch {
    return { remove: () => {} } as EventSubscription;
  }
}
