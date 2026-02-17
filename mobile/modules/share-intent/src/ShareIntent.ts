import { Platform } from "react-native";

let ShareIntentModule: {
  getSharedContent(): SharedContent | null;
  clearSharedContent(): void;
  getSharedImagePath(filename: string): string | null;
} | null = null;

try {
  ShareIntentModule = require("expo-modules-core").requireNativeModule("ShareIntent");
} catch {
  // Module not available (web or not built with native modules)
}

export interface SharedContent {
  url?: string;
  text?: string;
  images?: string[];
  timestamp?: number;
}

/**
 * Get shared content saved by the iOS Share Extension via App Group.
 * Returns null if no shared content is available or on non-iOS platforms.
 */
export function getSharedContent(): SharedContent | null {
  if (Platform.OS !== "ios" || !ShareIntentModule) {
    return null;
  }
  try {
    return ShareIntentModule.getSharedContent();
  } catch {
    return null;
  }
}

/**
 * Clear shared content after it has been consumed.
 */
export function clearSharedContent(): void {
  if (Platform.OS !== "ios" || !ShareIntentModule) {
    return;
  }
  try {
    ShareIntentModule.clearSharedContent();
  } catch {
    // Silently ignore
  }
}

/**
 * Get the full file path for a shared image filename in the App Group container.
 */
export function getSharedImagePath(filename: string): string | null {
  if (Platform.OS !== "ios" || !ShareIntentModule) {
    return null;
  }
  try {
    return ShareIntentModule.getSharedImagePath(filename);
  } catch {
    return null;
  }
}
