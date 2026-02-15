/**
 * Native Profile View Type Definitions
 * TypeScript types for the native profile view module
 */

import { ViewProps } from 'react-native';

// Profile data matching AT Protocol profile view
export interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  indexedAt?: string;
  viewer?: ProfileViewer;
  labels?: Label[];
}

// Profile viewer relationship info
export interface ProfileViewer {
  muted?: boolean;
  blockedBy?: boolean;
  blocking?: string; // URI of block record
  blockingByList?: ListViewBasic;
  following?: string; // URI of follow record
  followedBy?: string; // URI of follow record
}

export interface ListViewBasic {
  uri: string;
  cid: string;
  name: string;
  purpose: string;
  avatar?: string;
  viewer?: ListViewerState;
}

export interface ListViewerState {
  muted?: boolean;
  blocked?: string;
}

export interface Label {
  src?: string;
  uri?: string;
  cid?: string;
  val: string;
  cts?: string;
}

// Tab types
export type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

// Event types
export interface ProfileTabChangeEvent {
  tab: ProfileTab;
}

// Component props
export interface NativeProfileViewProps extends ViewProps {
  isOwnProfile?: boolean;
  isLoadingProfile?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onTabChange?: (event: { nativeEvent: ProfileTabChangeEvent }) => void;
  onFollowToggle?: () => void;
  onMessagePress?: () => void;
  onMenuPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onEditProfile?: () => void;
}
