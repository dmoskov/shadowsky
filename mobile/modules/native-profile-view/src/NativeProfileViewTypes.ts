/**
 * Native Profile View Type Definitions
 * TypeScript types for the native profile view module
 */

import { ViewProps } from "react-native";

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
  isVerified?: boolean;
  viewer?: ProfileViewer;
  labels?: Label[];
  pinnedPost?: PinnedPostRef;
  associated?: ProfileAssociated;
  knownFollowers?: KnownFollowers;
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

// Pinned post reference
export interface PinnedPostRef {
  uri: string;
}

// Associated profile data
export interface ProfileAssociated {
  lists?: number;
  feedgens?: number;
  starterPacks?: number;
  labeler?: boolean;
  chat?: ProfileAssociatedChat;
}

export interface ProfileAssociatedChat {
  allowIncoming?: string;
}

// Known followers (mutual follows)
export interface KnownFollowers {
  count: number;
  followers: KnownFollower[];
}

export interface KnownFollower {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

// Starter pack data
export interface StarterPackData {
  uri: string;
  cid?: string;
  name: string;
  listItemCount?: number;
  joinedAllTimeCount?: number;
}

// Pinned post data (resolved)
export interface PinnedPostData {
  uri: string;
  authorHandle: string;
  authorDisplayName?: string;
  authorAvatar?: string;
  text?: string;
  indexedAt?: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

// Tab types
export type ProfileTab = "posts" | "replies" | "media" | "likes";

// Event types
export interface ProfileTabChangeEvent {
  tab: ProfileTab;
}

export interface PinnedPostPressEvent {
  uri: string;
}

export interface StarterPackPressEvent {
  uri: string;
}

export interface KnownFollowerPressEvent {
  handle: string;
}

export interface ContentSizeChangeEvent {
  height: number;
  width: number;
}

// Component props
export interface NativeProfileViewProps extends ViewProps {
  isOwnProfile?: boolean;
  isLoadingProfile?: boolean;
  isRefreshing?: boolean;
  isFollowPending?: boolean;
  isMessagePending?: boolean;
  error?: string | null;
  errorType?: "deleted" | "suspended" | "blocked" | null;
  onRefresh?: () => void;
  onTabChange?: (event: { nativeEvent: ProfileTabChangeEvent }) => void;
  onFollowToggle?: () => void;
  onMessagePress?: () => void;
  onMenuPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onEditProfile?: () => void;
  onAddToList?: () => void;
  onPinnedPostPress?: (event: { nativeEvent: PinnedPostPressEvent }) => void;
  onStarterPackPress?: (event: { nativeEvent: StarterPackPressEvent }) => void;
  onSignOut?: () => void;
  onKnownFollowerPress?: (event: {
    nativeEvent: KnownFollowerPressEvent;
  }) => void;
  onContentSizeChange?: (event: {
    nativeEvent: ContentSizeChangeEvent;
  }) => void;
}
