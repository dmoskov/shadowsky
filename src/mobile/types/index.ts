/**
 * React Native Mobile Types
 *
 * Type definitions for React Native components that mirror the web app's
 * data structures while being optimized for mobile rendering.
 */

import type { AppBskyFeedDefs } from "@atproto/api";

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
