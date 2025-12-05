import { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bookmark,
  Heart,
  MessageCircle,
  MoreVertical,
  Repeat2,
  Reply,
  Sparkles,
} from "lucide-react";
import React, { memo } from "react";
import { useNavigate } from "react-router";
import { useModerationPreferences } from "../hooks/useModerationPreferences";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { createLogger } from "../utils/logger";
import { isValidUrl } from "../utils/security";
import { parseBskyUrl } from "../utils/url-helpers";
import { ImageGallery } from "./ImageGallery";
import { VideoPlayer } from "./VideoPlayer";
import { DomainVerifiedBadgeInline } from "./ui/DomainVerifiedBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { ProgressiveImage } from "./ui/ProgressiveImage";
import { RichText } from "./ui/RichText";

const logger = createLogger("PostRenderer");

async function loadAnthropicService() {
  return await import("../services/anthropic");
}

// Component to detect and render Bluesky URLs as embedded quotes
const BskyUrlEmbed: React.FC<{
  text: string;
  onQuoteClick?: (uri: string) => void;
}> = ({ text, onQuoteClick }) => {
  const [quotedPost, setQuotedPost] =
    React.useState<AppBskyFeedDefs.PostView | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchQuotedPost = async () => {
      // Check if text contains a Bluesky URL
      const bskyUrlMatch = text.match(
        /https?:\/\/bsky\.app\/profile\/[^\s]+\/post\/[^\s]+/,
      );
      if (!bskyUrlMatch) return;

      const url = bskyUrlMatch[0];
      const parsed = parseBskyUrl(url);
      if (!parsed || !parsed.postId) return;

      setLoading(true);
      try {
        const { atProtoClient } = await import("../services/atproto");
        const agent = atProtoClient.agent;
        if (!agent) return;

        // Resolve handle to DID if needed
        let did = parsed.did;
        if (!did && parsed.handle) {
          try {
            const profileResponse = await agent.getProfile({
              actor: parsed.handle,
            });
            did = profileResponse.data.did;
          } catch (error) {
            logger.error("Failed to resolve handle:", error);
            return;
          }
        }

        if (!did) return;

        // Construct AT URI with DID
        const uri = `at://${did}/app.bsky.feed.post/${parsed.postId}`;
        const response = await agent.app.bsky.feed.getPosts({ uris: [uri] });

        if (response.data.posts.length > 0) {
          setQuotedPost(response.data.posts[0]);
        }
      } catch (error) {
        logger.error("Failed to fetch quoted post from URL:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotedPost();
  }, [text]);

  if (loading) {
    return (
      <div
        className="mt-2 rounded-lg border p-4"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          <span>Loading quoted post...</span>
        </div>
      </div>
    );
  }

  if (!quotedPost) return null;

  const record = quotedPost.record as any;
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
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <img
              src={
                proxifyBskyImage(quotedPost.author.avatar) ||
                "/default-avatar.svg"
              }
              alt=""
              className="h-5 w-5 cursor-pointer rounded-full transition-opacity hover:opacity-80"
            />
          </ProfileHoverCard>
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <span className="cursor-pointer text-sm font-semibold hover:underline">
              {quotedPost.author.displayName || quotedPost.author.handle}
            </span>
          </ProfileHoverCard>
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <span
              className="cursor-pointer text-sm hover:underline"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{quotedPost.author.handle}
            </span>
          </ProfileHoverCard>
        </div>
        <p className="text-sm">{record?.text || ""}</p>
        {quotedPost.embed && (
          <div className="mt-2">
            {(quotedPost.embed as any).images && (
              <div className="grid grid-cols-2 gap-1">
                {(quotedPost.embed as any).images
                  .slice(0, 4)
                  .map((img: any, i: number) => (
                    <img
                      key={i}
                      src={proxifyBskyImage(img.thumb) || ""}
                      alt={img.alt || ""}
                      className="h-32 w-full rounded object-cover"
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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

/**
 * Custom comparison function for PostRenderer memoization
 * Prevents re-renders when only shallow prop references change
 */
function arePostRendererPropsEqual(
  prevProps: PostRendererProps,
  nextProps: PostRendererProps,
): boolean {
  // Compare post identity
  if (prevProps.post.uri !== nextProps.post.uri) return false;
  if (prevProps.post.cid !== nextProps.post.cid) return false;

  // Compare engagement counts
  if (prevProps.post.likeCount !== nextProps.post.likeCount) return false;
  if (prevProps.post.repostCount !== nextProps.post.repostCount) return false;
  if (prevProps.post.replyCount !== nextProps.post.replyCount) return false;

  // Compare viewer state
  if (prevProps.post.viewer?.like !== nextProps.post.viewer?.like) return false;
  if (prevProps.post.viewer?.repost !== nextProps.post.viewer?.repost)
    return false;

  // Compare UI props
  if (prevProps.isBookmarked !== nextProps.isBookmarked) return false;
  if (prevProps.compact !== nextProps.compact) return false;
  if (prevProps.showActions !== nextProps.showActions) return false;

  // Compare reason type (for repost indicators)
  const prevReasonType = prevProps.reason?.$type;
  const nextReasonType = nextProps.reason?.$type;
  if (prevReasonType !== nextReasonType) return false;

  // Callbacks are expected to be stable (using useCallback in parent)
  return true;
}

const PostRendererComponent: React.FC<PostRendererProps> = ({
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
  const [generatedAltTexts, setGeneratedAltTexts] = React.useState<
    Record<number, string>
  >({});
  const [generatingAltText, setGeneratingAltText] = React.useState<
    Record<number, boolean>
  >({});
  const [showAltText, setShowAltText] = React.useState<Record<number, boolean>>(
    {},
  );
  const [showSensitiveMedia, setShowSensitiveMedia] = React.useState(false);
  const { shouldBlurMedia, shouldHideMedia, getSensitiveWarningText } =
    useModerationPreferences();
  const { getProfilePrefetchHandlers, getThreadPrefetchHandlers } =
    useRoutePrefetch();

  // Get prefetch handlers for this post's author and thread
  const authorPrefetchHandlers = getProfilePrefetchHandlers(post.author.handle);
  const threadPrefetchHandlers = getThreadPrefetchHandlers(post.uri);

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

  const handleGenerateAltText = async (imageUrl: string, index: number) => {
    setGeneratingAltText((prev) => ({ ...prev, [index]: true }));
    try {
      // Pass the URL directly to the backend which will handle fetching
      const anthropicService = await loadAnthropicService();
      const altText = await anthropicService.generateAltText(imageUrl);

      setGeneratedAltTexts((prev) => ({ ...prev, [index]: altText }));
      setShowAltText((prev) => ({ ...prev, [index]: true }));
    } catch (error) {
      // Show user-friendly error message
      logger.error("Error generating alt text:", error);
      alert(
        error instanceof Error ? error.message : "Failed to generate alt text",
      );
    } finally {
      setGeneratingAltText((prev) => ({ ...prev, [index]: false }));
    }
  };

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    // Record with media (quoted post with images/video)
    if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
      return (
        <div className="mt-2 space-y-2">
          {/* Render the media first */}
          {embed.media && renderEmbed(embed.media)}
          {/* Then render the quoted post */}
          {embed.record && renderEmbed(embed.record)}
        </div>
      );
    }

    // Images
    if (embed.images) {
      const labels = (post as any).labels;
      const hideMedia = shouldHideMedia(labels);
      const blurMedia = shouldBlurMedia(labels);

      if (hideMedia && !showSensitiveMedia) {
        return (
          <div
            className="mt-2 flex items-center justify-center rounded-lg p-8 text-center"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="space-y-3">
              <AlertTriangle
                size={32}
                style={{
                  color: "var(--bsky-text-secondary)",
                  margin: "0 auto",
                }}
              />
              <div>
                <div
                  className="font-medium"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {getSensitiveWarningText(labels)}
                </div>
                <div
                  className="mt-1 text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  This content has been hidden based on your settings
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSensitiveMedia(true);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--bsky-bg-tertiary)",
                  color: "var(--bsky-text-primary)",
                  border: "1px solid var(--bsky-border-primary)",
                }}
              >
                Show Content
              </button>
            </div>
          </div>
        );
      }

      // Determine grid layout based on image count
      const gridClass =
        embed.images.length === 1
          ? "grid-cols-1"
          : embed.images.length === 2
            ? "grid-cols-2"
            : embed.images.length === 3
              ? "grid-cols-3"
              : "grid-cols-2";

      return (
        <div className={`relative mt-2`}>
          <div className={`grid gap-1 ${gridClass}`}>
            {embed.images.map((image: any, index: number) => {
              // Special layout for 3 images: first image takes 2/3, others 1/3 each
              const isThreeImageLayout = embed.images.length === 3;
              const colSpan =
                isThreeImageLayout && index === 0
                  ? "col-span-2 row-span-2"
                  : "";

              const currentAltText = generatedAltTexts[index] || image.alt;
              const hasAltText = currentAltText && currentAltText.length > 0;

              return (
                <div key={index} className={`group relative ${colSpan}`}>
                  <div
                    className="relative w-full cursor-pointer overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
                    style={{
                      aspectRatio:
                        isThreeImageLayout && index === 0 ? "1" : "16/9",
                      maxHeight:
                        isThreeImageLayout && index === 0 ? "500px" : "350px",
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      openImageGallery(embed.images, index);
                    }}
                  >
                    <ProgressiveImage
                      src={
                        proxifyBskyImage(image.fullsize || image.thumb) || ""
                      }
                      placeholderSrc={proxifyBskyImage(image.thumb) || ""}
                      alt={currentAltText || ""}
                      className="h-full w-full object-contain hover:opacity-90"
                      style={{
                        filter:
                          blurMedia && !showSensitiveMedia
                            ? "blur(20px)"
                            : "none",
                      }}
                    />
                  </div>

                  {/* Alt text overlay */}
                  {hasAltText && showAltText[index] && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black bg-opacity-70 p-2 text-xs text-white">
                      {currentAltText}
                    </div>
                  )}

                  {/* Alt text generation button */}
                  <button
                    className="absolute right-2 top-2 z-10 rounded-full bg-black bg-opacity-60 p-1.5 text-white opacity-0 transition-all hover:bg-opacity-80 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasAltText && !generatedAltTexts[index]) {
                        // Toggle showing existing alt text
                        setShowAltText((prev) => ({
                          ...prev,
                          [index]: !prev[index],
                        }));
                      } else if (!hasAltText) {
                        // Generate new alt text
                        handleGenerateAltText(
                          proxifyBskyImage(image.fullsize) ||
                            proxifyBskyImage(image.thumb) ||
                            "",
                          index,
                        );
                      }
                    }}
                    disabled={generatingAltText[index]}
                    title={hasAltText ? "Toggle alt text" : "Generate alt text"}
                  >
                    {generatingAltText[index] ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          {blurMedia && !showSensitiveMedia && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSensitiveMedia(true);
                }}
                className="rounded-lg px-6 py-3 text-sm font-medium shadow-lg transition-colors"
                style={{
                  backgroundColor: "var(--bsky-bg-primary)",
                  color: "var(--bsky-text-primary)",
                  border: "2px solid var(--bsky-border-primary)",
                }}
              >
                {getSensitiveWarningText(labels)} - Click to Show
              </button>
            </div>
          )}
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
            inTimeline={true}
          />
        </div>
      );
    }

    // Quoted post (app.bsky.embed.record#view)
    // Handle both typed and untyped record embeds
    if (
      (embed.$type === "app.bsky.embed.record#view" || !embed.$type) &&
      embed.record &&
      embed.record.$type === "app.bsky.embed.record#viewRecord"
    ) {
      // Check if it's a post view or if it's deleted/blocked
      const quotedPost = embed.record;

      // Handle deleted or blocked posts
      if (quotedPost.$type === "app.bsky.embed.record#viewNotFound") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border p-3 text-sm italic"
            style={{
              borderColor: "var(--bsky-border-primary)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            Post not found or deleted
          </div>
        );
      }

      if (quotedPost.$type === "app.bsky.embed.record#viewBlocked") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border p-3 text-sm italic"
            style={{
              borderColor: "var(--bsky-border-primary)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            Post from blocked user
          </div>
        );
      }

      // Normal quoted post
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
              {quotedPost.author?.handle && (
                <ProfileHoverCard handle={quotedPost.author.handle}>
                  <img
                    src={
                      proxifyBskyImage(quotedPost.author?.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt=""
                    className="quote-avatar h-5 w-5 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                  />
                </ProfileHoverCard>
              )}
              {quotedPost.author?.handle ? (
                <ProfileHoverCard handle={quotedPost.author.handle}>
                  <span className="quote-author-name cursor-pointer text-sm hover:underline">
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle}
                  </span>
                </ProfileHoverCard>
              ) : (
                <span className="quote-author-name text-sm">
                  {quotedPost.author?.displayName || quotedPost.author?.handle}
                </span>
              )}
              {quotedPost.author?.handle && (
                <DomainVerifiedBadgeInline handle={quotedPost.author.handle} />
              )}
            </div>
            <p className="quote-text text-sm">
              <RichText
                text={quotedPost.value?.text || ""}
                facets={quotedPost.value?.facets}
              />
            </p>
            {/* Render embedded content in the quoted post */}
            {quotedPost.embeds?.[0] && (
              <div className="mt-2">{renderEmbed(quotedPost.embeds[0])}</div>
            )}
          </div>
        </div>
      );
    }

    // Fallback for old-style record embeds without explicit type
    if (embed.record && !embed.$type) {
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
              {quotedPost.author?.handle && (
                <ProfileHoverCard handle={quotedPost.author.handle}>
                  <img
                    src={
                      proxifyBskyImage(quotedPost.author?.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt=""
                    className="quote-avatar h-5 w-5 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                  />
                </ProfileHoverCard>
              )}
              {quotedPost.author?.handle ? (
                <ProfileHoverCard handle={quotedPost.author.handle}>
                  <span className="quote-author-name cursor-pointer text-sm hover:underline">
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle}
                  </span>
                </ProfileHoverCard>
              ) : (
                <span className="quote-author-name text-sm">
                  {quotedPost.author?.displayName || quotedPost.author?.handle}
                </span>
              )}
              {quotedPost.author?.handle && (
                <DomainVerifiedBadgeInline handle={quotedPost.author.handle} />
              )}
            </div>
            <p className="quote-text text-sm">
              <RichText
                text={quotedPost.value?.text || ""}
                facets={quotedPost.value?.facets}
              />
            </p>
          </div>
        </div>
      );
    }

    // External link
    if (embed.external) {
      // Validate external URL to prevent XSS attacks
      const externalUri = embed.external.uri;
      const isUriValid = isValidUrl(externalUri);

      return (
        <div
          className="mt-2 cursor-pointer rounded-lg border p-2.5 transition-colors hover:bg-blue-500 hover:bg-opacity-5"
          style={{ borderColor: "var(--bsky-border-primary)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (externalUri && isUriValid) {
              // Check if it's a Bluesky URL
              const parsed = parseBskyUrl(externalUri);
              if (parsed && parsed.postId && parsed.handle) {
                // Navigate internally to the thread view
                navigate(`/thread/${parsed.handle}/${parsed.postId}`);
              } else {
                // Open external links in a new tab with security attributes
                window.open(externalUri, "_blank", "noopener,noreferrer");
              }
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
      <article
        className={`post-renderer p-4 ${compact ? "compact" : ""} ${record?.reply?.parent ? "is-reply" : ""} ${onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}`}
        onClick={handlePostClick}
        aria-label={`Post by ${post.author.displayName || post.author.handle}`}
      >
        {/* Repost context */}
        {reason && reason.$type === "app.bsky.feed.defs#reasonRepost" && (
          <div
            className="mb-2 flex items-center gap-2 text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <Repeat2 size={16} />
            <span className="inline-flex items-center">
              <ProfileHoverCard handle={(reason as any).by.handle}>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${(reason as any).by.handle}`);
                  }}
                >
                  {(reason as any).by.displayName || (reason as any).by.handle}
                </span>
              </ProfileHoverCard>
              {(reason as any).by.handle && (
                <DomainVerifiedBadgeInline handle={(reason as any).by.handle} />
              )}{" "}
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
          <ProfileHoverCard handle={post.author.handle}>
            <img
              src={
                proxifyBskyImage(post.author.avatar) || "/default-avatar.svg"
              }
              alt={post.author.handle}
              className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
              onClick={handleAuthorClick}
              {...authorPrefetchHandlers}
            />
          </ProfileHoverCard>

          <div className="min-w-0 flex-1">
            {/* Author info and menu */}
            <div className="flex items-start justify-between">
              <div className="flex flex-wrap items-center gap-1">
                <ProfileHoverCard handle={post.author.handle}>
                  <span
                    className="cursor-pointer font-semibold hover:underline"
                    style={{ color: "var(--bsky-text-primary)" }}
                    onClick={handleAuthorClick}
                    {...authorPrefetchHandlers}
                  >
                    {post.author.displayName || post.author.handle}
                  </span>
                </ProfileHoverCard>
                <ProfileHoverCard handle={post.author.handle}>
                  <span
                    className="cursor-pointer hover:underline"
                    style={{ color: "var(--bsky-text-secondary)" }}
                    onClick={handleAuthorClick}
                    {...authorPrefetchHandlers}
                  >
                    @{post.author.handle}
                  </span>
                </ProfileHoverCard>
                <DomainVerifiedBadgeInline handle={post.author.handle} />
                <span style={{ color: "var(--bsky-text-secondary)" }}>·</span>
                <span
                  className="cursor-pointer text-sm hover:underline"
                  style={{ color: "var(--bsky-text-secondary)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const postId = post.uri.split("/").pop();
                    navigate(`/thread/${post.author.handle}/${postId}`);
                  }}
                  {...threadPrefetchHandlers}
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
                  aria-label="More options"
                  aria-haspopup="menu"
                >
                  <MoreVertical
                    size={16}
                    style={{ color: "var(--bsky-text-secondary)" }}
                    aria-hidden="true"
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
                <RichText text={record?.text || ""} facets={record?.facets} />
              </p>
              {post.embed && renderEmbed(post.embed)}
              {/* If no embed but text contains a bsky URL, try to render it */}
              {!post.embed && record?.text && (
                <BskyUrlEmbed text={record.text} onQuoteClick={onQuoteClick} />
              )}
            </div>

            {/* Actions */}
            {showActions && !compact && (
              <div
                className="mt-3 flex items-center gap-4"
                role="group"
                aria-label="Post actions"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply?.();
                  }}
                  className="flex items-center gap-1 text-sm transition-colors hover:text-blue-500"
                  style={{ color: "var(--bsky-text-secondary)" }}
                  aria-label={`Reply to post, ${post.replyCount || 0} replies`}
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  <span aria-hidden="true">{post.replyCount || 0}</span>
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
                  aria-label={`${post.viewer?.repost ? "Undo repost" : "Repost"}, ${post.repostCount || 0} reposts`}
                  aria-pressed={!!post.viewer?.repost}
                >
                  <Repeat2 size={18} aria-hidden="true" />
                  <span aria-hidden="true">{post.repostCount || 0}</span>
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
                  aria-label={`${post.viewer?.like ? "Unlike" : "Like"}, ${post.likeCount || 0} likes`}
                  aria-pressed={!!post.viewer?.like}
                >
                  <Heart
                    size={18}
                    fill={post.viewer?.like ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                  <span aria-hidden="true">{post.likeCount || 0}</span>
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
                    aria-label={
                      isBookmarked ? "Remove bookmark" : "Bookmark post"
                    }
                    aria-pressed={isBookmarked}
                  >
                    <Bookmark
                      size={18}
                      fill={isBookmarked ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </article>

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

/**
 * Memoized PostRenderer for optimal feed scroll performance
 * Uses custom comparator to prevent cascading re-renders from parent components
 */
export const PostRenderer = memo(
  PostRendererComponent,
  arePostRendererPropsEqual,
);
