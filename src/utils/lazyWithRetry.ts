import { ComponentType, lazy } from "react";

/**
 * Wraps React.lazy with automatic retry logic for failed chunk loads.
 * When a chunk fails to load (typically after a deployment), it will:
 * 1. Try to import again (in case it was a temporary network issue)
 * 2. If that fails, reload the page to get the new HTML/JS bundle
 *
 * This prevents the "Failed to fetch dynamically imported module" error
 * that occurs when users have old cached HTML trying to load new chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem("page-has-been-force-refreshed") || "false",
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem("page-has-been-force-refreshed", "false");
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Store flag to prevent infinite reload loop
        window.sessionStorage.setItem("page-has-been-force-refreshed", "true");
        // Reload the page to get fresh HTML/JS
        window.location.reload();
        // Return a dummy component (page will reload before this renders)
        return {
          default: (() => null) as unknown as T,
        };
      }

      // If we've already tried reloading, throw the error
      throw error;
    }
  });
}
