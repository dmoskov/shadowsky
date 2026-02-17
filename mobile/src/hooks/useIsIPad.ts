import { Platform } from "react-native";

/**
 * Returns true if the app is running on an iPad.
 * Uses Platform.isPad which is available on iOS.
 */
export function useIsIPad(): boolean {
  return Platform.OS === "ios" && !!(Platform as any).isPad;
}

/**
 * Static check for iPad (no hook dependency).
 * Useful outside of React component context.
 */
export const isIPad = Platform.OS === "ios" && !!(Platform as any).isPad;
