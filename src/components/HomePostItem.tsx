import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import { Repeat2, Reply } from "lucide-react";
import React from "react";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../utils/image-proxy";
import { PostActionBar } from "./PostActionBar";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import type { FeedPageItem, Post } from "./Home.types";
import { FeedEmbed, type GalleryImage } from "./HomeFeedEmbed";

interface PostItemProps {
  item: FeedPageItem;
  index: number;
  isFocused: boolean;
  registerRef: (key: string, el: HTMLDivElement | null) => void;
  onActivate: (post: Post, index: number) => void;
  onOpenThread: (post: Post) => void;
  onOpenGallery: (images: GalleryImage[], index: number) => void;
  onOpenQuotedPost: (uri: string) => void;
  onReply: (post: Post) => void;
  onQuote: (post: Post) => void;
  onRepost: (post: Post) => void;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
  getThreadPrefetchHandlers: (postUri: string) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/**
 * A single post card in the home feed.
 *
 * Defined at module level (NOT inside Home) so its component identity is
 * stable across Home re-renders — defining it inline created a new component
 * type every render, forcing React to unmount/remount every visible post and
 * causing feed-wide flicker.
 */
export const PostItem = React.memo(
  ({
    item,
    index,
    isFocused,
    registerRef,
    onActivate,
    onOpenThread,
    onOpenGallery,
    onOpenQuotedPost,
    onReply,
    onQuote,
    onRepost,
    onLike,
    onBookmark,
    getThreadPrefetchHandlers,
  }: PostItemProps) => {
    const navigate = useViewTransitionNavigate();
    const post = item.post;

    return (
      <div
        ref={(el) => registerRef(`${post.uri}-${index}`, el)}
        className={`relative cursor-pointer px-3 py-2.5 transition-colors hover:bg-asph-bg-hover ${
          item.reply?.parent || post.record?.reply?.parent
            ? "from-blue-500/3 border-l-4 border-blue-500 bg-gradient-to-r to-transparent"
            : ""
        } ${isFocused ? "bg-blue-500/3 outline outline-2 outline-offset-[-2px] outline-blue-500" : ""}`}
        id={`post-${post.uri.split("/").pop()}`}
        data-post-id={post.uri.split("/").pop()}
        data-post-uri={post.uri}
        tabIndex={isFocused ? 0 : -1}
        aria-selected={isFocused}
        role="article"
        {...getThreadPrefetchHandlers(post.uri)}
        onClick={(e) => {
          // Only handle click if not on interactive elements
          const target = e.target as HTMLElement;
          const clickedOnInteractive =
            target.closest('[role="button"]') ||
            target.closest("button") ||
            target.closest("a") ||
            target.closest("[data-clickable]") ||
            target.tagName === "BUTTON" ||
            target.tagName === "A";

          if (!clickedOnInteractive) {
            onActivate(post, index);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpenThread(post);
          }
        }}
      >
        {item.reason && (
          <div
            className="mb-1.5 flex items-center gap-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Repeat2 size={12} />
            <span>
              <ProfileHoverCard handle={item.reason.by.handle}>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${item.reason?.by.handle}`);
                  }}
                >
                  {item.reason?.by.displayName || item.reason?.by.handle}
                </span>
              </ProfileHoverCard>{" "}
              reposted
            </span>
          </div>
        )}

        {/* Show reply context from feed item */}
        {item.reply?.parent && (
          <div className="relative">
            {/* Reply indicator with background */}
            <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="flex w-12 justify-center">
                  <div className="h-6 w-0.5 bg-asph-primary"></div>
                </div>
                <Reply size={16} className="mr-2 text-asph-primary" />
              </div>
              <div className="flex-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  Replying to{" "}
                  <ProfileHoverCard
                    handle={item.reply.parent.author?.handle || "unknown"}
                  >
                    <button
                      className="touch-target-sm font-semibold text-asph-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to parent post
                        const parentPost = item.reply?.parent;
                        if (parentPost) {
                          onOpenThread(parentPost);
                        }
                      }}
                    >
                      @{item.reply?.parent.author?.handle || "unknown"}
                    </button>
                  </ProfileHoverCard>
                </span>
                {item.reply.parent.record?.text && (
                  <div
                    className="mt-0.5 line-clamp-2 text-xs"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    "{item.reply.parent.record.text}"
                  </div>
                )}
              </div>
            </div>
            {/* Connecting line from reply indicator to avatar */}
            <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
          </div>
        )}

        {/* Show reply context from post record if not in feed item */}
        {!item.reply?.parent && post.record?.reply?.parent && (
          <div className="relative">
            {/* Reply indicator with background */}
            <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="flex w-12 justify-center">
                  <div className="h-6 w-0.5 bg-asph-primary"></div>
                </div>
                <Reply size={16} className="mr-2 text-asph-primary" />
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                This is a reply
              </span>
            </div>
            {/* Connecting line from reply indicator to avatar */}
            <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
          </div>
        )}

        <div>
          {/* Avatar and user info row */}
          <div className="flex items-start gap-3">
            <ProfileHoverCard handle={post.author.handle}>
              <img
                src={
                  proxifyBskyImage(post.author.avatar) || "/default-avatar.svg"
                }
                alt={post.author.handle}
                className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                data-clickable="profile"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${post.author.handle}`);
                }}
              />
            </ProfileHoverCard>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ProfileHoverCard handle={post.author.handle}>
                  <span
                    className="cursor-pointer font-semibold hover:underline inline-flex items-center min-h-[44px]"
                    style={{ color: "var(--asph-text-primary)" }}
                    data-clickable="profile"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${post.author.handle}`);
                    }}
                  >
                    {post.author.displayName || post.author.handle}
                  </span>
                </ProfileHoverCard>
                {(item.reply?.parent || post.record?.reply?.parent) && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--asph-primary)",
                      color: "white",
                    }}
                  >
                    REPLY
                  </span>
                )}
              </div>
              <div
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <ProfileHoverCard handle={post.author.handle}>
                  <span
                    className="cursor-pointer hover:underline"
                    data-clickable="profile"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${post.author.handle}`);
                    }}
                  >
                    @{post.author.handle}
                  </span>
                </ProfileHoverCard>{" "}
                ·{" "}
                <span
                  className="cursor-pointer hover:underline"
                  data-clickable="thread"
                  onClick={(e) => {
                    e.stopPropagation();
                    const postId = post.uri.split("/").pop();
                    navigate(`/thread/${post.author.handle}/${postId}`);
                  }}
                >
                  {formatDistanceToNow(new Date(post.record.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Post content below, aligned with avatar */}
          <div className="mt-2">
            <div
              className="whitespace-pre-wrap"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <RichText
                text={post.record.text}
                facets={
                  post.record.facets as Parameters<typeof RichText>[0]["facets"]
                }
              />
            </div>

            <FeedEmbed
              embed={post.embed}
              onOpenGallery={onOpenGallery}
              onOpenQuotedPost={onOpenQuotedPost}
            />

            {/* Post Action Bar */}
            <PostActionBar
              post={post as unknown as AppBskyFeedDefs.PostView}
              onReply={() => onReply(post)}
              onRepost={() => onRepost(post)}
              onQuote={() => onQuote(post)}
              onLike={() => onLike(post)}
              onBookmark={() => onBookmark(post)}
              showCounts={true}
              size="medium"
            />
          </div>
        </div>
      </div>
    );
  },
  // Custom comparison function: only re-render when the post's data,
  // position, or focus state actually changes
  (prevProps, nextProps) => {
    return (
      prevProps.item.post.uri === nextProps.item.post.uri &&
      prevProps.item.post.viewer?.like === nextProps.item.post.viewer?.like &&
      prevProps.item.post.viewer?.repost ===
        nextProps.item.post.viewer?.repost &&
      prevProps.item.post.likeCount === nextProps.item.post.likeCount &&
      prevProps.item.post.repostCount === nextProps.item.post.repostCount &&
      prevProps.item.post.replyCount === nextProps.item.post.replyCount &&
      prevProps.index === nextProps.index &&
      prevProps.isFocused === nextProps.isFocused
    );
  },
);

PostItem.displayName = "PostItem";
