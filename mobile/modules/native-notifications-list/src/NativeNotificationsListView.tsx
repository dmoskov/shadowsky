/**
 * Native Notifications List View Component
 *
 * React Native wrapper for the native SwiftUI NotificationListView.
 * Follows the same pattern as NativeFeedListView.tsx.
 */

import { useFocusEffect } from "@react-navigation/native";
import { requireNativeViewManager } from "expo-modules-core";
import { useRouter } from "expo-router";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Platform, View, ViewProps } from "react-native";
import {
  useMarkNotificationsSeen,
  useNotifications,
} from "../../../src/hooks/api/useNotifications";
import { useAppNavigation } from "../../../src/hooks/useNavigation";
import { useOfflineNotificationsEnhancer } from "../../../src/hooks/useOfflineFeed";
import { clearBadgeCount } from "../../../src/utils/badge";
import { openLink } from "../../../src/utils/browser";

// Lazy-load native modules (only available on iOS)
let NativeNotificationsListNative: any = null;

if (Platform.OS === "ios") {
  NativeNotificationsListNative = requireNativeViewManager(
    "NativeNotificationsList",
  );
}

// MARK: - Event Types

export interface NotificationListEvents {
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onNotificationPress?: (event: {
    nativeEvent: {
      reason: string;
      uri: string;
      handle: string;
      reasonSubject?: string;
    };
  }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onMentionPress?: (event: {
    nativeEvent: { handle: string; did: string };
  }) => void;
  onHashtagPress?: (event: { nativeEvent: { tag: string } }) => void;
  onLinkPress?: (event: { nativeEvent: { uri: string } }) => void;
  onAppear?: () => void;
  onAnalyticsPress?: () => void;
}

// MARK: - Props Types

export interface NativeNotificationsListProps
  extends ViewProps, NotificationListEvents {
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  isOnline?: boolean;
}

// MARK: - Low-level Native View

export const NativeNotificationsListView = forwardRef<
  any,
  NativeNotificationsListProps
>((props, _ref) => {
  const {
    isLoading = false,
    isRefreshing = false,
    isLoadingMore = false,
    error = null,
    isOnline = true,
    onRefresh,
    onLoadMore,
    onNotificationPress,
    onProfilePress,
    onMentionPress,
    onHashtagPress,
    onLinkPress,
    onAppear,
    onAnalyticsPress,
    ...viewProps
  } = props;

  if (Platform.OS !== "ios" || !NativeNotificationsListNative) {
    return <View {...viewProps} />;
  }

  return (
    <NativeNotificationsListNative
      {...viewProps}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isLoadingMore={isLoadingMore}
      error={error}
      isOnline={isOnline}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      onNotificationPress={onNotificationPress}
      onProfilePress={onProfilePress}
      onMentionPress={onMentionPress}
      onHashtagPress={onHashtagPress}
      onLinkPress={onLinkPress}
      onAppear={onAppear}
      onAnalyticsPress={onAnalyticsPress}
    />
  );
});

NativeNotificationsListView.displayName = "NativeNotificationsListView";

// MARK: - Utility Functions

function getPostIdFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

function getHandleFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[2] || "";
}

// MARK: - High-level Component with Data Bridge

export const NativeNotificationsList = forwardRef<any, ViewProps & { onScroll?: (event: { nativeEvent: { y: number } }) => void }>(
  (props, ref) => {
    const router = useRouter();
    const notificationsQuery = useNotifications();
    const enhancedNotificationsQuery = useOfflineNotificationsEnhancer(
      notificationsQuery,
      ["notifications"],
    );
    const {
      data,
      isLoading,
      isError,
      error,
      refetch,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    } = enhancedNotificationsQuery;
    const { isOnline: isNotifOnline } = enhancedNotificationsQuery;

    const markNotificationsSeen = useMarkNotificationsSeen();
    const { navigateToProfile, navigateToThread } = useAppNavigation();
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    // Bridge error state (notification bridge module removed)
    const bridgeError: string | null = null;

    // Handle refresh
    const handleRefresh = useCallback(() => {
      setIsManualRefreshing(true);
      refetch().finally(() => setIsManualRefreshing(false));
    }, [refetch]);

    // Handle load more
    const handleLoadMore = useCallback(() => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Mark notifications as seen when the tab is focused (handles tab switches)
    useFocusEffect(
      useCallback(() => {
        if (data?.pages?.[0]?.notifications?.length) {
          markNotificationsSeen.mutate(new Date().toISOString());
        }
        clearBadgeCount();
      }, [data?.pages]),
    );

    // Handle mark as seen on SwiftUI view appear (initial render)
    const handleAppear = useCallback(() => {
      if (data?.pages?.[0]?.notifications?.length) {
        markNotificationsSeen.mutate(new Date().toISOString());
      }
      clearBadgeCount();
    }, [data?.pages, markNotificationsSeen]);

    // Handle notification press - navigation logic from NotificationsScreen.tsx
    const handleNotificationPress = useCallback(
      (event: {
        nativeEvent: {
          reason: string;
          uri: string;
          handle: string;
          reasonSubject?: string;
        };
      }) => {
        const { reason, uri, handle, reasonSubject } = event.nativeEvent;

        if (reason === "follow" || reason === "starterpack-joined") {
          navigateToProfile(handle);
          return;
        }

        if (
          (reason === "like" ||
            reason === "repost" ||
            reason === "like-via-repost" ||
            reason === "repost-via-repost") &&
          reasonSubject
        ) {
          const postId = getPostIdFromUri(reasonSubject);
          const did = getHandleFromUri(reasonSubject);
          navigateToThread(handle, postId, did || undefined);
          return;
        }

        if (reason === "reply" || reason === "mention" || reason === "quote") {
          const postId = getPostIdFromUri(uri);
          const did = getHandleFromUri(uri);
          navigateToThread(handle, postId, did || undefined);
          return;
        }

        // Fallback
        navigateToProfile(handle);
      },
      [navigateToProfile, navigateToThread],
    );

    // Handle profile press
    const handleProfilePress = useCallback(
      (event: { nativeEvent: { handle: string } }) => {
        navigateToProfile(event.nativeEvent.handle);
      },
      [navigateToProfile],
    );

    // Handle mention press
    const handleMentionPress = useCallback(
      (event: { nativeEvent: { handle: string; did: string } }) => {
        navigateToProfile(event.nativeEvent.handle);
      },
      [navigateToProfile],
    );

    // Handle hashtag press
    const handleHashtagPress = useCallback(
      (event: { nativeEvent: { tag: string } }) => {
        router.push({
          pathname: "/(tabs)/(search)",
          params: { q: "#" + event.nativeEvent.tag },
        } as any);
      },
      [router],
    );

    // Handle link press
    const handleLinkPress = useCallback(
      (event: { nativeEvent: { uri: string } }) => {
        openLink(event.nativeEvent.uri).catch(() => {});
      },
      [],
    );

    // Handle analytics press - navigate to the JS analytics screen
    const handleAnalyticsPress = useCallback(() => {
      router.push("/(app)/analytics" as any);
    }, [router]);

    // Expose scroll-to-top
    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        // SwiftUI handles scroll-to-top natively
      },
    }));

    return (
      <NativeNotificationsListView
        {...props}
        isLoading={isLoading}
        isRefreshing={isManualRefreshing}
        isLoadingMore={isFetchingNextPage}
        error={
          isError
            ? error?.message || "Failed to load notifications"
            : bridgeError
        }
        isOnline={isNotifOnline}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onNotificationPress={handleNotificationPress}
        onProfilePress={handleProfilePress}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onLinkPress={handleLinkPress}
        onAppear={handleAppear}
        onAnalyticsPress={handleAnalyticsPress}
        style={{ flex: 1 }}
      />
    );
  },
);

NativeNotificationsList.displayName = "NativeNotificationsList";

export default NativeNotificationsList;
