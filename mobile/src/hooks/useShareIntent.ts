import { useEffect, useState, useCallback } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import type { SharedContent } from "../../modules/share-intent";

let shareIntentModule: typeof import("../../modules/share-intent") | null = null;
try {
  shareIntentModule = require("../../modules/share-intent");
} catch {
  // Not available
}

/**
 * Hook that checks for shared content from the iOS Share Extension.
 * It reads from the App Group UserDefaults when the app comes to foreground
 * and when the hook first mounts.
 */
export function useShareIntent() {
  const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);

  const checkForSharedContent = useCallback(() => {
    if (Platform.OS !== "ios" || !shareIntentModule) return;

    const content = shareIntentModule.getSharedContent();
    if (content) {
      setSharedContent(content);
    }
  }, []);

  const clearSharedContent = useCallback(() => {
    if (shareIntentModule) {
      shareIntentModule.clearSharedContent();
    }
    setSharedContent(null);
  }, []);

  const getImagePath = useCallback((filename: string): string | null => {
    if (!shareIntentModule) return null;
    return shareIntentModule.getSharedImagePath(filename);
  }, []);

  // Check on mount and when app comes to foreground
  useEffect(() => {
    checkForSharedContent();

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkForSharedContent();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkForSharedContent]);

  return {
    sharedContent,
    clearSharedContent,
    getImagePath,
    hasSharedContent: sharedContent !== null,
  };
}
