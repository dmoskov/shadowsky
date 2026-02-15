/**
 * React Native Mobile Module
 *
 * This module provides React Native components optimized for mobile feed rendering
 * with 60fps scroll performance. These components use FlatList virtualization
 * and are designed to work with the Bluesky AT Protocol API.
 *
 * Performance Features:
 * - FlatList with getItemLayout for O(1) scrolling
 * - React.memo with custom comparison functions
 * - Stable callbacks via useCallback
 * - Visibility-based lazy loading
 * - Optimized re-render prevention
 *
 * Usage:
 *   import { PostCard, FeedList } from './mobile';
 *   import { useFeedActions } from './mobile/hooks';
 *
 *   // In your component:
 *   const actions = useFeedActions({
 *     onLikePost: async (uri, cid) => { ... },
 *     onNavigateToThread: (post) => { ... },
 *   });
 *
 *   <FeedList
 *     items={feedItems}
 *     onPostPress={actions.onPostPress}
 *     onLike={actions.onLike}
 *     ...
 *   />
 */

// Components
export {
  FeedList,
  FeedView,
  MobileThreadSummary,
  PostCard,
  PostDetailView,
  ProfileView,
} from "./components";

// Types
export { FEED_CONSTANTS } from "./types";
export type {
  FeedDescriptor,
  FeedListProps,
  FeedType,
  FeedViewProps,
  MobilePostData,
  PostActionBarProps,
  PostCardProps,
  PostDetailViewProps,
  PostImage,
  ProfileViewProps,
} from "./types";

// Hooks
export { useFeedActions } from "./hooks";
export type { FeedActionHandlers, UseFeedActionsOptions } from "./hooks";
