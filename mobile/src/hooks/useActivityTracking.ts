/**
 * Activity Tracking Hook
 *
 * Provides helpers for tracking user interactions as breadcrumbs for Sentry.
 * Use these throughout the app to track key user actions for debugging purposes.
 *
 * Example usage:
 * ```
 * const { trackNavigation, trackCompose, trackLike, trackSearch } = useActivityTracking();
 *
 * // Track navigation
 * trackNavigation('/profile/123');
 *
 * // Track compose actions
 * trackCompose('start');
 * trackCompose('publish', { hasImages: true, hasLinks: false });
 *
 * // Track like/unlike
 * trackLike('post', 'at://did:plc:123/app.bsky.feed.post/abc123');
 *
 * // Track search
 * trackSearch('posts', 'query text');
 * ```
 */

import { useCallback } from "react";
import { addBreadcrumb } from "../utils/error-reporting";

export function useActivityTracking() {
  /**
   * Track navigation to a screen or route
   * @param screenName - Name or path of the screen
   * @param params - Optional route parameters
   */
  const trackNavigation = useCallback(
    (screenName: string, params?: Record<string, unknown>) => {
      addBreadcrumb("navigate", `Navigated to ${screenName}`, params);
    },
    []
  );

  /**
   * Track compose/post creation actions
   * @param action - Action type (start, cancel, publish, draft)
   * @param metadata - Optional metadata (hasImages, hasLinks, isReply, etc.)
   */
  const trackCompose = useCallback(
    (
      action: "start" | "cancel" | "publish" | "draft",
      metadata?: Record<string, unknown>
    ) => {
      addBreadcrumb("compose", `Compose: ${action}`, metadata);
    },
    []
  );

  /**
   * Track like/unlike actions
   * @param contentType - Type of content (post, reply, etc.)
   * @param uri - AT Protocol URI (will be excluded from breadcrumb for privacy)
   */
  const trackLike = useCallback(
    (contentType: string, uri?: string) => {
      addBreadcrumb("like", `Liked ${contentType}`, {
        contentType,
        // Don't include full URI for privacy, just confirm action
        hasUri: !!uri,
      });
    },
    []
  );

  /**
   * Track unlike actions
   * @param contentType - Type of content (post, reply, etc.)
   * @param uri - AT Protocol URI (will be excluded from breadcrumb for privacy)
   */
  const trackUnlike = useCallback(
    (contentType: string, uri?: string) => {
      addBreadcrumb("like", `Unliked ${contentType}`, {
        contentType,
        hasUri: !!uri,
      });
    },
    []
  );

  /**
   * Track repost actions
   * @param uri - AT Protocol URI (will be excluded from breadcrumb for privacy)
   */
  const trackRepost = useCallback((uri?: string) => {
    addBreadcrumb("repost", "Reposted content", {
      hasUri: !!uri,
    });
  }, []);

  /**
   * Track unrepost actions
   * @param uri - AT Protocol URI (will be excluded from breadcrumb for privacy)
   */
  const trackUnrepost = useCallback((uri?: string) => {
    addBreadcrumb("repost", "Unreposted content", {
      hasUri: !!uri,
    });
  }, []);

  /**
   * Track search actions
   * @param searchType - Type of search (posts, users, feeds, etc.)
   * @param query - Search query (first 50 chars only for privacy)
   */
  const trackSearch = useCallback(
    (searchType: string, query: string) => {
      // Truncate query for privacy and brevity
      const truncatedQuery = query.length > 50 ? query.slice(0, 50) + "..." : query;
      addBreadcrumb("search", `Search ${searchType}`, {
        searchType,
        queryLength: query.length,
        query: truncatedQuery,
      });
    },
    []
  );

  /**
   * Track follow/unfollow actions
   * @param action - Action type (follow, unfollow)
   * @param did - User DID (will be hashed by Sentry)
   */
  const trackFollow = useCallback(
    (action: "follow" | "unfollow", did?: string) => {
      addBreadcrumb("follow", `${action} user`, {
        action,
        hasDid: !!did,
      });
    },
    []
  );

  /**
   * Track feed selection/switching
   * @param feedUri - Feed URI or identifier
   * @param feedType - Type of feed (following, discover, custom, etc.)
   */
  const trackFeedSwitch = useCallback(
    (feedUri: string, feedType?: string) => {
      addBreadcrumb("feed", `Switched to feed`, {
        feedType: feedType || "unknown",
        // Don't include full URI for privacy
        hasFeedUri: !!feedUri,
      });
    },
    []
  );

  /**
   * Track notification interactions
   * @param action - Action type (view, open, mark_read, etc.)
   * @param notificationType - Type of notification (like, repost, follow, mention, reply)
   */
  const trackNotification = useCallback(
    (
      action: "view" | "open" | "mark_read" | "clear",
      notificationType?: string
    ) => {
      addBreadcrumb("notification", `Notification: ${action}`, {
        action,
        notificationType,
      });
    },
    []
  );

  /**
   * Track profile interactions
   * @param action - Action type (view, edit, etc.)
   * @param did - User DID (will be hashed by Sentry)
   */
  const trackProfile = useCallback(
    (action: "view" | "edit" | "update", did?: string) => {
      addBreadcrumb("profile", `Profile: ${action}`, {
        action,
        hasDid: !!did,
      });
    },
    []
  );

  /**
   * Track media interactions
   * @param action - Action type (view, upload, download)
   * @param mediaType - Type of media (image, video, gif)
   */
  const trackMedia = useCallback(
    (action: "view" | "upload" | "download", mediaType: string) => {
      addBreadcrumb("media", `Media: ${action}`, {
        action,
        mediaType,
      });
    },
    []
  );

  /**
   * Track settings changes
   * @param setting - Setting that was changed
   * @param value - New value (be careful not to include sensitive data)
   */
  const trackSettingChange = useCallback(
    (setting: string, value?: string | boolean | number) => {
      addBreadcrumb("settings", `Changed ${setting}`, {
        setting,
        valueType: typeof value,
      });
    },
    []
  );

  return {
    trackNavigation,
    trackCompose,
    trackLike,
    trackUnlike,
    trackRepost,
    trackUnrepost,
    trackSearch,
    trackFollow,
    trackFeedSwitch,
    trackNotification,
    trackProfile,
    trackMedia,
    trackSettingChange,
  };
}
