/**
 * Native Profile View Component
 * React Native wrapper for the native SwiftUI profile view
 */

import {
  NativeModulesProxy,
  requireNativeViewManager,
} from "expo-modules-core";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import {
  NativeProfileViewProps,
  PinnedPostData,
  ProfileData,
  StarterPackData,
} from "./NativeProfileViewTypes";

// Get the native modules
const ProfileBridge = NativeModulesProxy.ProfileBridge;

// Native view manager
const NativeProfileViewNative =
  Platform.OS === "ios" ? requireNativeViewManager("NativeProfileView") : null;

/**
 * Low-level Native Profile View component
 * Renders the native SwiftUI view with provided props
 */
export const NativeProfileView = forwardRef<any, NativeProfileViewProps>(
  (props, _ref) => {
    const {
      isOwnProfile = false,
      isLoadingProfile = false,
      isRefreshing = false,
      isFollowPending = false,
      isMessagePending = false,
      error = null,
      errorType = null,
      onRefresh,
      onTabChange,
      onFollowToggle,
      onMessagePress,
      onMenuPress,
      onFollowersPress,
      onFollowingPress,
      onEditProfile,
      onAddToList,
      onPinnedPostPress,
      onStarterPackPress,
      onSignOut,
      onKnownFollowerPress,
      onContentSizeChange,
      ...viewProps
    } = props;

    // iOS only - on Android, this would render a fallback
    if (Platform.OS !== "ios" || !NativeProfileViewNative) {
      return null;
    }

    return (
      <NativeProfileViewNative
        {...viewProps}
        isOwnProfile={isOwnProfile}
        isLoadingProfile={isLoadingProfile}
        isRefreshing={isRefreshing}
        isFollowPending={isFollowPending}
        isMessagePending={isMessagePending}
        error={error}
        errorType={errorType}
        onRefresh={onRefresh}
        onTabChange={onTabChange}
        onFollowToggle={onFollowToggle}
        onMessagePress={onMessagePress}
        onMenuPress={onMenuPress}
        onFollowersPress={onFollowersPress}
        onFollowingPress={onFollowingPress}
        onEditProfile={onEditProfile}
        onAddToList={onAddToList}
        onPinnedPostPress={onPinnedPostPress}
        onStarterPackPress={onStarterPackPress}
        onSignOut={onSignOut}
        onKnownFollowerPress={onKnownFollowerPress}
        onContentSizeChange={onContentSizeChange}
      />
    );
  },
);

NativeProfileView.displayName = "NativeProfileView";

/**
 * High-level Native Profile View component with automatic data bridge
 * Automatically serializes profile data and passes it to Swift via ProfileBridge
 */
export interface NativeProfileViewWithDataProps extends Omit<
  NativeProfileViewProps,
  "isLoadingProfile" | "isRefreshing" | "error" | "errorType"
> {
  profile: ProfileData | null;
  isLoading?: boolean;
  error?: Error | null;
  errorType?: "deleted" | "suspended" | "blocked" | null;
  starterPacks?: StarterPackData[];
  pinnedPost?: PinnedPostData | null;
}

export const NativeProfileViewWithData = forwardRef<
  any,
  NativeProfileViewWithDataProps
>((props, ref) => {
  const {
    profile,
    isLoading = false,
    error = null,
    errorType = null,
    starterPacks,
    pinnedPost,
    style,
    ...rest
  } = props;

  // Track the measured height from the native view
  const [nativeHeight, setNativeHeight] = useState<number | undefined>(undefined);

  const handleContentSizeChange = useCallback(
    (event: { nativeEvent: { height: number; width: number } }) => {
      const { height } = event.nativeEvent;
      if (height > 0) {
        setNativeHeight(height);
      }
    },
    [],
  );

  // Serialize and send profile data to Swift
  useEffect(() => {
    if (profile && ProfileBridge) {
      const serialized = JSON.stringify(profile);
      ProfileBridge.updateProfileData(serialized);
    }
  }, [profile]);

  // Only clear profile data on unmount
  useEffect(() => {
    return () => {
      if (ProfileBridge) {
        ProfileBridge.clearProfileData();
      }
    };
  }, []);

  // Serialize and send starter packs data to Swift
  useEffect(() => {
    if (starterPacks && starterPacks.length > 0 && ProfileBridge) {
      const serialized = JSON.stringify(starterPacks);
      ProfileBridge.updateStarterPacks(serialized);
    }
  }, [starterPacks]);

  // Serialize and send pinned post data to Swift
  useEffect(() => {
    if (pinnedPost && ProfileBridge) {
      const serialized = JSON.stringify(pinnedPost);
      ProfileBridge.updatePinnedPost(serialized);
    }
  }, [pinnedPost]);

  // Combine parent style with measured native height
  const combinedStyle = StyleSheet.flatten([
    style,
    nativeHeight != null ? { height: nativeHeight } : undefined,
  ]);

  return (
    <NativeProfileView
      {...rest}
      ref={ref}
      style={combinedStyle}
      isLoadingProfile={isLoading}
      error={error?.message || null}
      errorType={errorType}
      onContentSizeChange={handleContentSizeChange}
    />
  );
});

NativeProfileViewWithData.displayName = "NativeProfileViewWithData";

export default NativeProfileView;
