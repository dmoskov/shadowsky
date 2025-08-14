import { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreVertical,
  Repeat2,
  Reply,
} from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { ImageGallery } from "./ImageGallery";
import { VideoPlayer } from "./VideoPlayer";

interface PostRendererProps {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onBookmark?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  isBookmarked?: boolean;
  compact?: boolean;
  showActions?: boolean;
  onClick?: () => void;
  onQuoteClick?: (uri: string) => void;
}

export const PostRenderer: React.FC<PostRendererProps> = ({
  post,
  reason,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  onMenuClick,
  isBookmarked = false,
  compact = false,
  showActions = true,
  onClick,
  onQuoteClick,
}) => {
  const navigate = useNavigate();
  const record = post.record as any;
  const [galleryImages, setGalleryImages] = React.useState<Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }> | null>(null);
  const [galleryIndex, setGalleryIndex] = React.useState(0);

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${post.author.handle}`);
  };

  const handlePostClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const openImageGallery = (images: any[], index: number) => {
    setGalleryImages(
      images.map((img: any) => ({
        thumb: proxifyBskyImage(img.thumb) || "",
        fullsize: proxifyBskyImage(img.fullsize) || "",
        alt: img.alt,
      })),
    );
    setGalleryIndex(index);
  };

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    // Images
    if (embed.images) {
      return (
        <div
          className={`mt-2 grid gap-2 ${embed.images.length > 2 ? "grid-cols-2" : embed.images.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {embed.images.map((image: any, index: number) => (
            <img
              key={index}
              src={proxifyBskyImage(image.thumb)}
              alt={image.alt || ""}
              className="cursor-pointer rounded-lg object-cover hover:opacity-90"
              style={{ maxHeight: "400px" }}
              onClick={(e) => {
                e.stopPropagation();
                openImageGallery(embed.images, index);
              }}
            />
          ))}
        </div>
      );
    }

    // Video
    if (embed.video) {
      return (
        <div className="mt-2">
          <VideoPlayer
            src={proxifyBskyVideo(embed.video) || ""}
            thumbnail={
              embed.thumbnail ? proxifyBskyImage(embed.thumbnail) : undefined
            }
          />
        </div>
      );
    }

    // Quoted post
    if (embed.record) {
      const quotedPost = embed.record;
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-colors hover:bg-gray-500 hover:bg-opacity-5"
          style={{ borderColor: "var(--bsky-border-primary)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (onQuoteClick && quotedPost.uri) {
              onQuoteClick(quotedPost.uri);
            }
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--bsky-bg-tertiary)",
              borderBottom: "1px solid var(--bsky-border-primary)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            <MessageCircle size={12} />
            <span>Quoted post</span>
          </div>
          <div className="p-3">
            <div className="quote-author mb-2 flex items-center gap-2">
              <img
                src={
                  proxifyBskyImage(quotedPost.author?.avatar) ||
                  "/default-avatar.svg"
                }
                alt=""
                className="quote-avatar h-5 w-5 rounded-full"
              />
              <span className="quote-author-name text-sm">
                {quotedPost.author?.displayName || quotedPost.author?.handle}
              </span>
            </div>
            <p className="quote-text text-sm">{quotedPost.value?.text || ""}</p>
          </div>
        </div>
      );
    }

    // External link
    if (embed.external) {
      return (
        <div
          className="mt-2 cursor-pointer rounded-lg border p-2.5 transition-colors hover:bg-blue-500 hover:bg-opacity-5"
          style={{ borderColor: "var(--bsky-border-primary)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (embed.external.uri) {
              window.open(embed.external.uri, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {embed.external.thumb && (
            <img
              src={proxifyBskyImage(embed.external.thumb)}
              alt=""
              className="mb-2 h-auto w-full rounded object-cover"
              style={{
                maxHeight: "200px",
                backgroundColor: "var(--bsky-bg-tertiary)",
              }}
            />
          )}
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {embed.external.title}
          </div>
          <div
            className="mt-1 text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {embed.external.description}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div
        className={`post-renderer p-4 ${compact ? "compact" : ""} ${record?.reply?.parent ? "is-reply" : ""} ${onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}`}
        onClick={handlePostClick}
      >
        {/* Repost context */}
        {reason && reason.$type === "app.bsky.feed.defs#reasonRepost" && (
          <div
            className="mb-2 flex items-center gap-2 text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <Repeat2 size={16} />
            <span>
              {(reason as any).by.displayName || (reason as any).by.handle}{" "}
              reposted
            </span>
          </div>
        )}

        {/* Reply context */}
        {record?.reply?.parent && (
          <div
            className="mb-2 flex items-center gap-2 text-sm"
            style={{ color: "rgb(29, 155, 240)" }}
          >
            <Reply size={16} />
            <span>Reply</span>
          </div>
        )}

        <div className="flex gap-3">
          {/* Author avatar */}
          <img
            src={proxifyBskyImage(post.author.avatar) || "/default-avatar.svg"}
            alt={post.author.handle}
            className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
            onClick={handleAuthorClick}
          />

          <div className="min-w-0 flex-1">
            {/* Author info and menu */}
            <div className="flex items-start justify-between">
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className="cursor-pointer font-semibold hover:underline"
                  style={{ color: "var(--bsky-text-primary)" }}
                  onClick={handleAuthorClick}
                >
                  {post.author.displayName || post.author.handle}
                </span>
                <span
                  className="cursor-pointer hover:underline"
                  style={{ color: "var(--bsky-text-secondary)" }}
                  onClick={handleAuthorClick}
                >
                  @{post.author.handle}
                </span>
                <span style={{ color: "var(--bsky-text-secondary)" }}>·</span>
                <span
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  {formatDistanceToNow(new Date(post.indexedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {onMenuClick && (
                <button
                  onClick={onMenuClick}
                  className="rounded-full p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <MoreVertical
                    size={16}
                    style={{ color: "var(--bsky-text-secondary)" }}
                  />
                </button>
              )}
            </div>

            {/* Post content */}
            <div className="mt-1">
              <p
                className="whitespace-pre-wrap"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {record?.text || ""}
              </p>
              {renderEmbed(post.embed)}
            </div>

            {/* Actions */}
            {showActions && !compact && (
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply?.();
                  }}
                  className="flex items-center gap-1 text-sm transition-colors hover:text-blue-500"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <MessageCircle size={18} />
                  <span>{post.replyCount || 0}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRepost?.();
                  }}
                  className={`flex items-center gap-1 text-sm transition-colors hover:text-green-500 ${
                    post.viewer?.repost ? "text-green-500" : ""
                  }`}
                  style={{
                    color: post.viewer?.repost
                      ? undefined
                      : "var(--bsky-text-secondary)",
                  }}
                >
                  <Repeat2 size={18} />
                  <span>{post.repostCount || 0}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike?.();
                  }}
                  className={`flex items-center gap-1 text-sm transition-colors hover:text-red-500 ${
                    post.viewer?.like ? "text-red-500" : ""
                  }`}
                  style={{
                    color: post.viewer?.like
                      ? undefined
                      : "var(--bsky-text-secondary)",
                  }}
                >
                  <Heart
                    size={18}
                    fill={post.viewer?.like ? "currentColor" : "none"}
                  />
                  <span>{post.likeCount || 0}</span>
                </button>

                {onBookmark && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookmark();
                    }}
                    className={`flex items-center gap-1 text-sm transition-colors hover:text-blue-500 ${
                      isBookmarked ? "text-blue-500" : ""
                    }`}
                    style={{
                      color: isBookmarked
                        ? undefined
                        : "var(--bsky-text-secondary)",
                    }}
                  >
                    <Bookmark
                      size={18}
                      fill={isBookmarked ? "currentColor" : "none"}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Gallery Modal */}
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryImages(null)}
        />
      )}
    </>
  );
};
