/**
 * useFeedActions Hook
 *
 * Custom hook providing stable callbacks for feed interactions.
 * Using useCallback to ensure callbacks are stable across renders,
 * which is critical for FlatList performance optimization.
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { useCallback } from "react";

export interface FeedActionHandlers {
  onLike: (post: AppBskyFeedDefs.PostView) => Promise<void>;
  onRepost: (post: AppBskyFeedDefs.PostView) => Promise<void>;
  onReply: (post: AppBskyFeedDefs.PostView) => void;
  onQuote: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark: (post: AppBskyFeedDefs.PostView) => Promise<void>;
  onPostPress: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress: (handle: string) => void;
  onQuotePress: (uri: string) => void;
}

export interface UseFeedActionsOptions {
  onLikePost?: (uri: string, cid: string) => Promise<void>;
  onUnlikePost?: (likeUri: string) => Promise<void>;
  onRepostPost?: (uri: string, cid: string) => Promise<void>;
  onUnrepostPost?: (repostUri: string) => Promise<void>;
  onOpenReplyComposer?: (post: AppBskyFeedDefs.PostView) => void;
  onOpenQuoteComposer?: (post: AppBskyFeedDefs.PostView) => void;
  onAddBookmark?: (uri: string) => Promise<void>;
  onRemoveBookmark?: (uri: string) => Promise<void>;
  onNavigateToThread?: (post: AppBskyFeedDefs.PostView) => void;
  onNavigateToProfile?: (handle: string) => void;
  isBookmarked?: (uri: string) => boolean;
}

/**
 * Hook that provides stable, memoized callbacks for feed actions
 */
export function useFeedActions(
  options: UseFeedActionsOptions,
): FeedActionHandlers {
  const {
    onLikePost,
    onUnlikePost,
    onRepostPost,
    onUnrepostPost,
    onOpenReplyComposer,
    onOpenQuoteComposer,
    onAddBookmark,
    onRemoveBookmark,
    onNavigateToThread,
    onNavigateToProfile,
    isBookmarked,
  } = options;

  const onLike = useCallback(
    async (post: AppBskyFeedDefs.PostView) => {
      if (post.viewer?.like) {
        await onUnlikePost?.(post.viewer.like);
      } else {
        await onLikePost?.(post.uri, post.cid);
      }
    },
    [onLikePost, onUnlikePost],
  );

  const onRepost = useCallback(
    async (post: AppBskyFeedDefs.PostView) => {
      if (post.viewer?.repost) {
        await onUnrepostPost?.(post.viewer.repost);
      } else {
        await onRepostPost?.(post.uri, post.cid);
      }
    },
    [onRepostPost, onUnrepostPost],
  );

  const onReply = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onOpenReplyComposer?.(post);
    },
    [onOpenReplyComposer],
  );

  const onQuote = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onOpenQuoteComposer?.(post);
    },
    [onOpenQuoteComposer],
  );

  const onBookmark = useCallback(
    async (post: AppBskyFeedDefs.PostView) => {
      if (isBookmarked?.(post.uri)) {
        await onRemoveBookmark?.(post.uri);
      } else {
        await onAddBookmark?.(post.uri);
      }
    },
    [onAddBookmark, onRemoveBookmark, isBookmarked],
  );

  const onPostPress = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onNavigateToThread?.(post);
    },
    [onNavigateToThread],
  );

  const onAuthorPress = useCallback(
    (handle: string) => {
      onNavigateToProfile?.(handle);
    },
    [onNavigateToProfile],
  );

  const onQuotePress = useCallback(
    (uri: string) => {
      // Parse URI to extract post details and navigate
      const parts = uri.split("/");
      const handle = parts[2]; // at://did/app.bsky.feed.post/rkey
      if (handle) {
        onNavigateToProfile?.(handle);
      }
    },
    [onNavigateToProfile],
  );

  return {
    onLike,
    onRepost,
    onReply,
    onQuote,
    onBookmark,
    onPostPress,
    onAuthorPress,
    onQuotePress,
  };
}
