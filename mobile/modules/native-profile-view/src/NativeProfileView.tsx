/**
 * Native Profile View Component
 * React Native wrapper for the native SwiftUI profile view
 */

import React, { useEffect, useCallback, forwardRef } from 'react';
import { requireNativeViewManager, NativeModulesProxy } from 'expo-modules-core';
import { Platform } from 'react-native';
import { NativeProfileViewProps, ProfileData } from './NativeProfileViewTypes';

// Get the native modules
const ProfileBridge = NativeModulesProxy.ProfileBridge;

// Native view manager
const NativeProfileViewNative = Platform.OS === 'ios' ? requireNativeViewManager('NativeProfileView') : null;

/**
 * Low-level Native Profile View component
 * Renders the native SwiftUI view with provided props
 */
export const NativeProfileView = forwardRef<any, NativeProfileViewProps>((props, ref) => {
  const {
    isOwnProfile = false,
    isLoadingProfile = false,
    isRefreshing = false,
    error = null,
    onRefresh,
    onTabChange,
    onFollowToggle,
    onMessagePress,
    onMenuPress,
    onFollowersPress,
    onFollowingPress,
    onEditProfile,
    ...viewProps
  } = props;

  // iOS only - on Android, this would render a fallback
  if (Platform.OS !== 'ios' || !NativeProfileViewNative) {
    return null;
  }

  return (
    <NativeProfileViewNative
      {...viewProps}
      isOwnProfile={isOwnProfile}
      isLoadingProfile={isLoadingProfile}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={onRefresh}
      onTabChange={onTabChange}
      onFollowToggle={onFollowToggle}
      onMessagePress={onMessagePress}
      onMenuPress={onMenuPress}
      onFollowersPress={onFollowersPress}
      onFollowingPress={onFollowingPress}
      onEditProfile={onEditProfile}
    />
  );
});

NativeProfileView.displayName = 'NativeProfileView';

/**
 * High-level Native Profile View component with automatic data bridge
 * Automatically serializes profile data and passes it to Swift via ProfileBridge
 */
export interface NativeProfileViewWithDataProps extends Omit<NativeProfileViewProps, 'isLoadingProfile' | 'isRefreshing' | 'error'> {
  profile: ProfileData | null;
  isLoading?: boolean;
  error?: Error | null;
}

export const NativeProfileViewWithData = forwardRef<any, NativeProfileViewWithDataProps>((props, ref) => {
  const {
    profile,
    isLoading = false,
    error = null,
    ...rest
  } = props;

  // Serialize and send profile data to Swift
  useEffect(() => {
    if (profile && ProfileBridge) {
      const serialized = JSON.stringify(profile);
      ProfileBridge.updateProfileData(serialized);
    }

    return () => {
      if (ProfileBridge) {
        ProfileBridge.clearProfileData();
      }
    };
  }, [profile]);

  return (
    <NativeProfileView
      {...rest}
      ref={ref}
      isLoadingProfile={isLoading}
      error={error?.message || null}
      style={{ flex: 1 }}
    />
  );
});

NativeProfileViewWithData.displayName = 'NativeProfileViewWithData';

export default NativeProfileView;
