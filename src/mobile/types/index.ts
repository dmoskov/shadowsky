/**
 * React Native Mobile Types
 *
 * Type definitions for React Native components that mirror the web app's
 * data structures while being optimized for mobile rendering.
 */

import type { AppBskyActorDefs, AppBskyFeedDefs } from "@atproto/api";
import type React from "react";

/**
 * Post data structure for mobile rendering
 * Extends the AT Protocol PostView with mobile-specific optimizations
 */
export interface MobilePostData {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  key: string;
}

/**
 * Props for the PostCard component
 */
export interface PostCardProps {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  onPress?: () => void;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  onAuthorPress?: (handle: string) => void;
  onQuotePress?: (uri: string) => void;
  showBorder?: boolean;
  isVisible?: boolean;
}

/**
 * Props for the FeedList component
 */
export interface FeedListProps {
  items: MobilePostData[];
  onPostPress: (post: AppBskyFeedDefs.PostView) => void;
  onLike?: (post: AppBskyFeedDefs.PostView) => void;
  onRepost?: (post: AppBskyFeedDefs.PostView) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onQuote?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress?: (handle: string) => void;
  onQuotePress?: (uri: string) => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  ListEmptyComponent?: React.ReactElement;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
}

/**
 * Props for PostDetailView component
 */
export interface PostDetailViewProps {
  post: AppBskyFeedDefs.PostView;
  replies?: MobilePostData[];
  parentPosts?: AppBskyFeedDefs.PostView[];
  threadSummary?: React.ReactNode;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  onAuthorPress?: (handle: string) => void;
  onQuotePress?: (uri: string) => void;
  onReplyPress?: (post: AppBskyFeedDefs.PostView) => void;
  onParentPress?: (post: AppBskyFeedDefs.PostView) => void;
  onLoadMoreReplies?: () => void;
  hasMoreReplies?: boolean;
  isLoadingReplies?: boolean;
  onBack?: () => void;
}

/**
 * Props for ProfileView component
 */
export interface ProfileViewProps {
  profile: AppBskyActorDefs.ProfileViewDetailed;
  posts: MobilePostData[];
  onPostPress: (uri: string) => void;
  onLike?: (uri: string) => void;
  onRepost?: (uri: string) => void;
  onReply?: (uri: string) => void;
  onQuote?: (uri: string) => void;
  onBookmark?: (uri: string) => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onBack?: () => void;
}

/**
 * Feed type options for FeedView
 */
export type FeedType =
  | "timeline"
  | "following"
  | "discover"
  | "custom"
  | string;

/**
 * Feed descriptor for custom feeds
 */
export interface FeedDescriptor {
  uri: string;
  displayName: string;
  description?: string;
}

/**
 * Props for FeedView component
 */
export interface FeedViewProps {
  activeFeed: FeedType;
  availableFeeds?: FeedDescriptor[];
  posts: MobilePostData[];
  onFeedChange?: (feedType: FeedType) => void;
  onPostPress: (post: AppBskyFeedDefs.PostView) => void;
  onLike?: (post: AppBskyFeedDefs.PostView) => void;
  onRepost?: (post: AppBskyFeedDefs.PostView) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onQuote?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress?: (handle: string) => void;
  onQuotePress?: (uri: string) => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  showFeedSelector?: boolean;
}

/**
 * Post action bar props
 */
export interface PostActionBarProps {
  post: AppBskyFeedDefs.PostView;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  showCounts?: boolean;
  compact?: boolean;
}

/**
 * Image data for posts
 */
export interface PostImage {
  thumb: string;
  fullsize: string;
  alt?: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

/**
 * Constants for FlatList optimization
 */
export const FEED_CONSTANTS = {
  /** Estimated height of a post without images */
  BASE_POST_HEIGHT: 150,
  /** Estimated height of a post with single image */
  POST_WITH_IMAGE_HEIGHT: 350,
  /** Estimated height of a post with multiple images */
  POST_WITH_GALLERY_HEIGHT: 400,
  /** Number of items to render beyond visible area */
  WINDOW_SIZE: 10,
  /** Minimum batch size for rendering */
  MAX_TO_RENDER_PER_BATCH: 5,
  /** Time between batches in ms */
  UPDATE_CELLS_BATCH_PERIOD: 50,
  /** Initial number of items to render */
  INITIAL_NUM_TO_RENDER: 10,
  /** Threshold for triggering onEndReached (0.5 = halfway) */
  ON_END_REACHED_THRESHOLD: 0.5,
} as const;
