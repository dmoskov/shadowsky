/**
 * Predictive Route Prefetching Service
 *
 * Implements intelligent route prefetching using simple heuristics:
 * 1. Hover intent detection (prefetch on hover after delay)
 * 2. Common navigation patterns (home->profile, feed->thread, etc.)
 *
 * NO ML - just hover detection and common pattern heuristics.
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("RoutePrefetchService");

/**
 * Lazy-loaded route components mapped by route pattern.
 * These are the import functions that will preload the route chunks.
 */
const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  home: () => import("../components/SkyDeck"),
  profile: () => import("../pages/ProfilePage"),
  thread: () => import("../pages/ThreadPage"),
  notifications: () =>
    import("../components/Notifications").then((m) => m.Notifications),
  search: () =>
    import("../components/SearchTabbed").then((m) => m.SearchTabbed),
  messages: () =>
    import("../components/DirectMessages").then((m) => m.DirectMessages),
  bookmarks: () => import("../components/Bookmarks").then((m) => m.Bookmarks),
  settings: () => import("../pages/Settings").then((m) => m.Settings),
  compose: () => import("../components/Composer").then((m) => m.Composer),
  lists: () => import("../components/Lists").then((m) => m.Lists),
  timeline: () =>
    import("../components/VisualTimeline").then((m) => m.VisualTimeline),
  analytics: () =>
    import("../pages/UserAnalytics").then((m) => m.UserAnalytics),
};

/**
 * Common navigation patterns based on typical user behavior.
 * Maps current route -> likely next routes (in order of likelihood).
 *
 * These are based on common social media usage patterns:
 * - Home is the hub, users often go to notifications or profiles
 * - Profile users often click into threads or back home
 * - Thread users often go back to profile or home
 * - Notifications users often click to threads or profiles
 */
const COMMON_NAVIGATION_PATTERNS: Record<string, string[]> = {
  // From home feed, users commonly go to:
  "/": ["profile", "thread", "notifications", "compose"],
  "/home": ["profile", "thread", "notifications", "compose"],

  // From profile, users commonly go to:
  profile: ["thread", "home", "messages"],

  // From thread view, users commonly go to:
  thread: ["profile", "home"],

  // From notifications, users commonly go to:
  "/notifications": ["thread", "profile", "home"],

  // From search, users commonly go to:
  "/search": ["profile", "thread"],

  // From messages, users commonly go to:
  "/messages": ["profile", "home"],

  // From bookmarks, users commonly go to:
  "/bookmarks": ["thread", "profile", "home"],

  // From compose, users commonly go back to:
  "/compose": ["home", "profile"],

  // From lists, users commonly go to:
  "/lists": ["home", "profile"],

  // From settings, users commonly go back to:
  "/settings": ["home", "profile"],
};

/**
 * Cache for preloaded route modules to avoid duplicate loads.
 */
const preloadedRoutes = new Set<string>();

/**
 * Pending prefetch operations to avoid duplicates.
 */
const pendingPrefetches = new Map<string, Promise<unknown>>();

/**
 * Extract route type from a pathname.
 */
function getRouteType(pathname: string): string {
  if (pathname === "/" || pathname === "/home") return "home";
  if (pathname.startsWith("/profile/")) return "profile";
  if (pathname.startsWith("/thread/")) return "thread";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/bookmarks")) return "bookmarks";
  if (pathname.startsWith("/compose")) return "compose";
  if (pathname.startsWith("/lists")) return "lists";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/timeline")) return "timeline";
  if (pathname.startsWith("/analytics")) return "analytics";
  return "unknown";
}

/**
 * Preload a route's JavaScript chunk.
 * This loads the code but doesn't render anything.
 */
async function preloadRouteChunk(routeType: string): Promise<void> {
  // Skip if already preloaded or unknown route
  if (preloadedRoutes.has(routeType)) return;

  const loader = ROUTE_LOADERS[routeType];
  if (!loader) return;

  // Check if there's already a pending prefetch
  const existingPrefetch = pendingPrefetches.get(routeType);
  if (existingPrefetch) {
    await existingPrefetch;
    return;
  }

  try {
    const prefetchPromise = loader();
    pendingPrefetches.set(routeType, prefetchPromise);

    await prefetchPromise;
    preloadedRoutes.add(routeType);
    logger.log(`Preloaded route chunk: ${routeType}`);
  } catch (error) {
    logger.error(`Failed to preload route chunk: ${routeType}`, error);
  } finally {
    pendingPrefetches.delete(routeType);
  }
}

/**
 * Route Prefetch Service singleton.
 * Manages predictive prefetching based on navigation patterns.
 */
class RoutePrefetchService {
  private isEnabled = true;
  private lastNavigationTime = 0;
  private navigationHistory: string[] = [];
  private maxHistoryLength = 10;

  /**
   * Enable or disable prefetching.
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.log(`Route prefetching ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if prefetching is enabled.
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Record a navigation event and prefetch likely next routes.
   * Call this when the user navigates to a new route.
   */
  recordNavigation(pathname: string): void {
    if (!this.isEnabled) return;

    // De-duplicate: skip if this is the same as the last navigation
    const lastNavigation =
      this.navigationHistory[this.navigationHistory.length - 1];
    if (lastNavigation === pathname) {
      return;
    }

    const now = Date.now();
    this.lastNavigationTime = now;

    // Add to history
    this.navigationHistory.push(pathname);
    if (this.navigationHistory.length > this.maxHistoryLength) {
      this.navigationHistory.shift();
    }

    // Prefetch likely next routes after a short delay
    // This ensures we don't block the current navigation
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(
        () => {
          this.prefetchLikelyRoutes(pathname);
        },
        { timeout: 2000 },
      );
    } else {
      // Fallback for Safari/iOS
      setTimeout(() => {
        this.prefetchLikelyRoutes(pathname);
      }, 100);
    }
  }

  /**
   * Prefetch routes that are likely to be visited next based on patterns.
   */
  private prefetchLikelyRoutes(currentPathname: string): void {
    if (!this.isEnabled) return;

    // Get route type for pattern matching
    const routeType = getRouteType(currentPathname);

    // Look up common patterns for this route
    const patterns =
      COMMON_NAVIGATION_PATTERNS[currentPathname] ||
      COMMON_NAVIGATION_PATTERNS[routeType] ||
      [];

    // Prefetch the top 2 most likely routes
    const routesToPrefetch = patterns.slice(0, 2);

    for (const route of routesToPrefetch) {
      preloadRouteChunk(route);
    }

    logger.log(
      `Prefetching routes based on pattern for ${currentPathname}:`,
      routesToPrefetch,
    );
  }

  /**
   * Prefetch a specific route's chunk.
   * Call this on hover intent (after delay).
   */
  prefetchRoute(routeOrPath: string): void {
    if (!this.isEnabled) return;

    const routeType = routeOrPath.startsWith("/")
      ? getRouteType(routeOrPath)
      : routeOrPath;

    preloadRouteChunk(routeType);
  }

  /**
   * Prefetch multiple routes.
   * Useful for preloading common routes on app init.
   */
  prefetchRoutes(routes: string[]): void {
    if (!this.isEnabled) return;

    for (const route of routes) {
      this.prefetchRoute(route);
    }
  }

  /**
   * Get whether a route's chunk has been preloaded.
   */
  isRoutePreloaded(routeOrPath: string): boolean {
    const routeType = routeOrPath.startsWith("/")
      ? getRouteType(routeOrPath)
      : routeOrPath;
    return preloadedRoutes.has(routeType);
  }

  /**
   * Get the last recorded navigation timestamp.
   */
  getLastNavigationTime(): number {
    return this.lastNavigationTime;
  }

  /**
   * Get recent navigation history.
   */
  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  /**
   * Clear navigation history.
   */
  clearHistory(): void {
    this.navigationHistory = [];
  }
}

// Export singleton instance
export const routePrefetchService = new RoutePrefetchService();

// Export types and utilities
export { getRouteType, preloadRouteChunk };
