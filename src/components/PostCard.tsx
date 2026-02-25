import { AppBskyFeedDefs } from "@atproto/api";
import React, { memo } from "react";
import { extractPostId } from "../hooks/usePostDeepLink";
import { PostActionBar } from "./PostActionBar";
import { PostRenderer } from "./PostRenderer";

interface PostCardProps {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  /** Parent post view from feed data, used to show rich reply context */
  replyParent?: AppBskyFeedDefs.PostView;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  onClick?: () => void;
  onQuoteClick?: (uri: string) => void;
  showBorder?: boolean;
  /** Whether this post is targeted via URL deep link */
  isDeepLinkTarget?: boolean;
}

/**
 * Custom comparison function for React.memo
 * Prevents unnecessary re-renders by comparing only relevant props
 * that would cause visual changes to the PostCard
 */
function arePostCardPropsEqual(
  prevProps: PostCardProps,
  nextProps: PostCardProps,
): boolean {
  // Compare post identity - if different, it's a different post
  if (prevProps.post.uri !== nextProps.post.uri) return false;
  if (prevProps.post.cid !== nextProps.post.cid) return false;

  // Compare engagement counts (these update frequently during scrolling)
  if (prevProps.post.likeCount !== nextProps.post.likeCount) return false;
  if (prevProps.post.repostCount !== nextProps.post.repostCount) return false;
  if (prevProps.post.replyCount !== nextProps.post.replyCount) return false;

  // Compare viewer state (user's interactions with the post)
  if (prevProps.post.viewer?.like !== nextProps.post.viewer?.like) return false;
  if (prevProps.post.viewer?.repost !== nextProps.post.viewer?.repost)
    return false;
  if (
    prevProps.post.viewer?.replyDisabled !==
    nextProps.post.viewer?.replyDisabled
  )
    return false;
  if (
    prevProps.post.viewer?.embeddingDisabled !==
    nextProps.post.viewer?.embeddingDisabled
  )
    return false;

  // Compare UI props
  if (prevProps.showBorder !== nextProps.showBorder) return false;
  if (prevProps.isDeepLinkTarget !== nextProps.isDeepLinkTarget) return false;

  // Compare reason (for repost indicators)
  const prevReasonType = prevProps.reason?.$type;
  const nextReasonType = nextProps.reason?.$type;
  if (prevReasonType !== nextReasonType) return false;

  // Compare reply parent identity
  if (prevProps.replyParent?.uri !== nextProps.replyParent?.uri) return false;

  // Callbacks are expected to be stable (using useCallback in parent)
  // so we skip comparing them to avoid unnecessary re-renders
  return true;
}

const PostCardComponent: React.FC<PostCardProps> = ({
  post,
  reason,
  replyParent,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onClick,
  onQuoteClick,
  showBorder = true,
  isDeepLinkTarget = false,
}) => {
  const authorName =
    post.author?.displayName || post.author?.handle || "Unknown user";

  // Extract post ID for deep linking
  const postId = extractPostId(post.uri);

  return (
    <article
      role="article"
      aria-label={`Post by ${authorName}`}
      id={`post-${postId}`}
      data-post-id={postId}
      data-post-uri={post.uri}
      className={`${showBorder ? "border-b" : ""} ${isDeepLinkTarget ? "deep-link-highlight" : ""}`}
      style={showBorder ? { borderColor: "var(--asph-border-primary)" } : {}}
    >
      <PostRenderer
        post={post}
        reason={reason}
        replyParent={replyParent}
        showActions={false}
        onClick={onClick}
        onQuoteClick={onQuoteClick}
      />
      <div className="px-4 pb-3">
        <PostActionBar
          post={post}
          onLike={onLike}
          onRepost={onRepost}
          onReply={onReply}
          onQuote={onQuote}
          onBookmark={onBookmark}
          showCounts={true}
        />
      </div>
    </article>
  );
};

/**
 * Memoized PostCard for optimal feed scroll performance
 * Uses custom comparator to prevent cascading re-renders
 */
export const PostCard = memo(PostCardComponent, arePostCardPropsEqual);
