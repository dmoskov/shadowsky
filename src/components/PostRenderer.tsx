import { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  BellOff,
  Bookmark,
  Globe,
  Heart,
  List,
  Loader,
  MessageCircle,
  MoreVertical,
  Repeat2,
  Reply,
  Rss,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import React, { memo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useModeration } from "../contexts/ModerationContext";
import { usePostTranslation } from "../hooks/usePostTranslation";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { fetchLinkMetadata, type LinkMetadata } from "../services/anthropic";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { createLogger } from "../utils/logger";
import { isValidUrl } from "../utils/security";
import { parseBskyUrl } from "../utils/url-helpers";
import { extractFirstLinkUrl } from "./composer/utils";
import { ImageGallery } from "./ImageGallery";
import { GateIndicator } from "./ReplyControls";
import { DomainVerifiedBadgeInline } from "./ui/DomainVerifiedBadge";
import { LabelBadge, getContentWarningLabels } from "./ui/LabelBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { ProgressiveImage } from "./ui/ProgressiveImage";
import { RichText } from "./ui/RichText";
import { VideoPlayer } from "./VideoPlayer";

const logger = createLogger("PostRenderer");

/**
 * Helper to get the root URI of a thread.
 * For reply posts, returns the root URI from the reply record.
 * For top-level posts, returns the post URI itself.
 */
function getThreadRootUri(post: AppBskyFeedDefs.PostView): string {
  const record = post.record as
    | { reply?: { root: { uri: string } } }
    | undefined;
  return record?.reply?.root?.uri || post.uri;
}

// Check if content has sensitive labels that should be blurred
const hasSensitiveLabels = (labels?: Array<{ val: string }>): boolean => {
  if (!labels || labels.length === 0) return false;
  const warningLabels = getContentWarningLabels(labels);
  return warningLabels.length > 0;
};

async function loadAnthropicService() {
  return await import("../services/anthropic");
}

// Component to detect and render Bluesky URLs as embedded quotes
const BskyUrlEmbed: React.FC<{
  text: string;
  onQuoteClick?: (uri: string) => void;
}> = ({ text, onQuoteClick }) => {
  const { agent } = useAuth();
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

      if (!agent) return;

      setLoading(true);
      try {
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
  }, [text, agent]);

  if (loading) {
    return (
      <div
        className="mt-2 rounded-xl p-4"
        style={{
          backgroundColor: "var(--asph-bg-tertiary)",
          boxShadow: "var(--asph-shadow-ring)",
        }}
      >
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          <div
            className="h-4 w-4 animate-spin rounded-full border-2"
            style={{
              borderColor: "var(--asph-border-secondary)",
              borderTopColor: "var(--asph-primary)",
            }}
          />
          <span>Loading quoted post...</span>
        </div>
      </div>
    );
  }

  if (!quotedPost) return null;

  const record = quotedPost.record as any;
  return (
    <div
      className="embed-card-refined mt-2 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        if (onQuoteClick && quotedPost.uri) {
          onQuoteClick(quotedPost.uri);
        }
      }}
    >
      <div className="embed-card-header">
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
              style={{ color: "var(--asph-text-secondary)" }}
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
                      key={`quote-img-${img.thumb}-${i}`}
                      src={proxifyBskyImage(img.thumb) || ""}
                      alt={img.alt || ""}
                      className="h-32 w-full rounded object-cover"
                      width={img.aspectRatio?.width}
                      height={img.aspectRatio?.height}
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

// Component to detect and render external URLs as link previews
const ExternalLinkEmbed: React.FC<{
  text: string;
}> = ({ text }) => {
  const [metadata, setMetadata] = React.useState<LinkMetadata | null>(null);
  const [loading, setLoading] = React.useState(false);

  const url = extractFirstLinkUrl(text);

  React.useEffect(() => {
    if (!url) {
      setMetadata(null);
      return;
    }

    let cancelled = false;
    const fetchMetadataAsync = async () => {
      setLoading(true);
      try {
        const data = await fetchLinkMetadata(url);
        if (!cancelled) {
          setMetadata(data);
        }
      } catch (error) {
        logger.error("Failed to fetch link metadata:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Debounce
    const timer = setTimeout(fetchMetadataAsync, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-xl p-3 text-sm"
        style={{
          backgroundColor: "var(--asph-bg-tertiary)",
          color: "var(--asph-text-secondary)",
          boxShadow: "var(--asph-shadow-ring)",
        }}
      >
        <Loader size={14} className="animate-spin" />
        <span>Loading link preview...</span>
      </div>
    );
  }

  if (!metadata) return null;

  let domain = "";
  try {
    domain = new URL(metadata.url).hostname.replace("www.", "");
  } catch {
    domain = metadata.url;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isValidUrl(metadata.url)) {
      window.open(metadata.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="embed-card-refined mt-2 cursor-pointer"
      onClick={handleClick}
    >
      {metadata.imageUrl && (
        <img
          src={metadata.imageUrl}
          alt=""
          className="h-40 w-full object-cover"
        />
      )}
      <div className="p-3">
        <div
          className="mb-1 text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          {domain}
        </div>
        <div
          className="line-clamp-2 text-sm font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {metadata.title}
        </div>
        {metadata.description && (
          <div
            className="mt-1 line-clamp-2 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {metadata.description}
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
  const { isThreadMuted } = useModeration();
  const record = post.record as any;
  const rootUri = getThreadRootUri(post);
  const isThreadMutedState = isThreadMuted(rootUri);
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
  const { getProfilePrefetchHandlers, getThreadPrefetchHandlers } =
    useRoutePrefetch();

  // Get prefetch handlers for this post's author and thread
  const authorPrefetchHandlers = getProfilePrefetchHandlers(post.author.handle);
  const threadPrefetchHandlers = getThreadPrefetchHandlers(post.uri);

  // Translation support
  const {
    showTranslateButton,
    isTranslating,
    translatedText,
    isShowingTranslation,
    translationError,
    sourceLanguageName,
    handleTranslate,
  } = usePostTranslation({
    postUri: post.uri,
    postText: record?.text || "",
    postLangs: record?.langs as string[] | undefined,
  });

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
      // Use simple label-based sensitivity check (blur by default, never completely hide)
      const blurMedia = hasSensitiveLabels(labels);

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

              // Extract aspect ratio from image metadata
              const imageAspectRatio = image.aspectRatio
                ? image.aspectRatio.width / image.aspectRatio.height
                : isThreeImageLayout && index === 0
                  ? 1
                  : 16 / 9;

              return (
                <div
                  key={`post-image-${image.thumb}-${index}`}
                  className={`group relative ${colSpan}`}
                >
                  <div
                    className="relative w-full cursor-pointer overflow-hidden rounded-xl"
                    style={{
                      backgroundColor: "var(--asph-bg-tertiary)",
                      aspectRatio: imageAspectRatio,
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
                      aspectRatio={imageAspectRatio}
                      width={image.aspectRatio?.width}
                      height={image.aspectRatio?.height}
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
                  backgroundColor: "var(--asph-bg-primary)",
                  color: "var(--asph-text-primary)",
                  border: "2px solid var(--asph-border-primary)",
                }}
              >
                <LabelBadge
                  labels={labels || []}
                  showContentWarningsOnly={true}
                  size="sm"
                />{" "}
                - Click to Show
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

    // Record embeds (app.bsky.embed.record#view)
    // Handles quoted posts, starter packs, feed generators, lists, labelers
    if (embed.$type === "app.bsky.embed.record#view" && embed.record) {
      const recordData = embed.record;

      // Handle deleted or blocked posts
      if (recordData.$type === "app.bsky.embed.record#viewNotFound") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-xl p-3 text-sm italic"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-secondary)",
              boxShadow: "var(--asph-shadow-ring)",
            }}
          >
            Post not found or deleted
          </div>
        );
      }

      if (recordData.$type === "app.bsky.embed.record#viewBlocked") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-xl p-3 text-sm italic"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-secondary)",
              boxShadow: "var(--asph-shadow-ring)",
            }}
          >
            Post from blocked user
          </div>
        );
      }

      if (recordData.$type === "app.bsky.embed.record#viewDetached") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-xl p-3 text-sm italic"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-secondary)",
              boxShadow: "var(--asph-shadow-ring)",
            }}
          >
            Post is no longer available
          </div>
        );
      }

      // Starter pack embed
      if (recordData.$type === "app.bsky.graph.defs#starterPackViewBasic") {
        const starterPack = recordData as any;
        const packRecord = starterPack.record as any;
        const packName = packRecord?.name || "Starter Pack";
        const packDescription = packRecord?.description || "";
        return (
          <div
            className="embed-card-refined mt-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Open the starter pack on bsky.app
              if (starterPack.creator?.handle) {
                const rkey = starterPack.uri?.split("/").pop();
                if (rkey) {
                  window.open(
                    `https://bsky.app/starter-pack/${starterPack.creator.handle}/${rkey}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }
            }}
          >
            <div className="embed-card-header">
              <Users size={12} />
              <span>Starter Pack</span>
            </div>
            <div className="p-3">
              <div className="mb-1 flex items-center gap-2">
                {starterPack.creator?.avatar && (
                  <img
                    src={
                      proxifyBskyImage(starterPack.creator.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                )}
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {packName}
                </span>
              </div>
              {packDescription && (
                <p
                  className="mt-1 line-clamp-2 text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {packDescription}
                </p>
              )}
              <div
                className="mt-2 flex items-center gap-3 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {starterPack.creator?.handle && (
                  <span>by @{starterPack.creator.handle}</span>
                )}
                {starterPack.listItemCount != null && (
                  <span>{starterPack.listItemCount} members</span>
                )}
                {starterPack.joinedAllTimeCount != null && (
                  <span>{starterPack.joinedAllTimeCount} joined</span>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Feed generator embed
      if (recordData.$type === "app.bsky.feed.defs#generatorView") {
        const feedGen = recordData as any;
        return (
          <div
            className="embed-card-refined mt-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Open the feed on bsky.app
              if (feedGen.creator?.handle) {
                const rkey = feedGen.uri?.split("/").pop();
                if (rkey) {
                  window.open(
                    `https://bsky.app/profile/${feedGen.creator.handle}/feed/${rkey}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }
            }}
          >
            <div className="embed-card-header">
              <Rss size={12} />
              <span>Feed</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                {feedGen.avatar && (
                  <img
                    src={proxifyBskyImage(feedGen.avatar)}
                    alt=""
                    className="h-8 w-8 rounded-lg"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {feedGen.displayName}
                  </span>
                  {feedGen.creator?.handle && (
                    <div
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      by @{feedGen.creator.handle}
                    </div>
                  )}
                </div>
              </div>
              {feedGen.description && (
                <p
                  className="mt-2 line-clamp-2 text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {feedGen.description}
                </p>
              )}
              {feedGen.likeCount != null && feedGen.likeCount > 0 && (
                <div
                  className="mt-2 flex items-center gap-1 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  <Heart size={11} />
                  <span>{feedGen.likeCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      // List embed
      if (recordData.$type === "app.bsky.graph.defs#listView") {
        const listView = recordData as any;
        const purposeLabel =
          listView.purpose === "app.bsky.graph.defs#modlist"
            ? "Moderation List"
            : listView.purpose === "app.bsky.graph.defs#curatelist"
              ? "User List"
              : "List";
        return (
          <div
            className="embed-card-refined mt-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (listView.creator?.handle) {
                const rkey = listView.uri?.split("/").pop();
                if (rkey) {
                  window.open(
                    `https://bsky.app/profile/${listView.creator.handle}/lists/${rkey}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }
            }}
          >
            <div className="embed-card-header">
              <List size={12} />
              <span>{purposeLabel}</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                {listView.avatar && (
                  <img
                    src={proxifyBskyImage(listView.avatar)}
                    alt=""
                    className="h-8 w-8 rounded-lg"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {listView.name}
                  </span>
                  {listView.creator?.handle && (
                    <div
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      by @{listView.creator.handle}
                    </div>
                  )}
                </div>
              </div>
              {listView.description && (
                <p
                  className="mt-2 line-clamp-2 text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {listView.description}
                </p>
              )}
              {listView.listItemCount != null && (
                <div
                  className="mt-2 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  {listView.listItemCount} members
                </div>
              )}
            </div>
          </div>
        );
      }

      // Labeler service embed
      if (recordData.$type === "app.bsky.labeler.defs#labelerView") {
        const labeler = recordData as any;
        return (
          <div
            className="embed-card-refined mt-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (labeler.creator?.handle) {
                window.open(
                  `https://bsky.app/profile/${labeler.creator.handle}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
          >
            <div className="embed-card-header">
              <Shield size={12} />
              <span>Labeler</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                {labeler.creator?.avatar && (
                  <img
                    src={
                      proxifyBskyImage(labeler.creator.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {labeler.creator?.displayName || labeler.creator?.handle}
                  </span>
                  {labeler.creator?.handle && (
                    <div
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      @{labeler.creator.handle}
                    </div>
                  )}
                </div>
              </div>
              {labeler.likeCount != null && labeler.likeCount > 0 && (
                <div
                  className="mt-2 flex items-center gap-1 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  <Heart size={11} />
                  <span>{labeler.likeCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Normal quoted post (app.bsky.embed.record#viewRecord)
      if (recordData.$type === "app.bsky.embed.record#viewRecord") {
        const quotedPost = recordData;
        return (
          <div
            className="embed-card-refined mt-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (onQuoteClick && quotedPost.uri) {
                onQuoteClick(quotedPost.uri);
              }
            }}
          >
            <div className="embed-card-header">
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
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle}
                  </span>
                )}
                {quotedPost.author?.handle && (
                  <DomainVerifiedBadgeInline
                    handle={quotedPost.author.handle}
                  />
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
    }

    // Fallback for old-style record embeds without explicit type
    if (embed.record && !embed.$type) {
      const quotedPost = embed.record;
      return (
        <div
          className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
          style={{ borderColor: "var(--asph-border-primary)" }}
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
              backgroundColor: "var(--asph-bg-tertiary)",
              borderBottom: "1px solid var(--asph-border-primary)",
              color: "var(--asph-text-secondary)",
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
          className="embed-card-refined relative mt-2 cursor-pointer p-2.5"
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
                backgroundColor: "var(--asph-bg-tertiary)",
              }}
            />
          )}
          <div
            className="line-clamp-2 text-sm font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            {embed.external.title}
          </div>
          <div
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
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
        className={`post-renderer p-4 ${compact ? "compact" : ""} ${record?.reply?.parent ? "is-reply" : ""} ${onClick ? "post-hover-refined cursor-pointer" : ""}`}
        onClick={handlePostClick}
        aria-label={`Post by ${post.author.displayName || post.author.handle}`}
      >
        {/* Repost context */}
        {reason && reason.$type === "app.bsky.feed.defs#reasonRepost" && (
          <div
            className="mb-2 flex items-center gap-2 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
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
            style={{ color: "var(--asph-primary)" }}
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
                    className="max-w-[200px] cursor-pointer truncate font-semibold hover:underline"
                    style={{ color: "var(--asph-text-primary)" }}
                    onClick={handleAuthorClick}
                    {...authorPrefetchHandlers}
                  >
                    {post.author.displayName || post.author.handle}
                  </span>
                </ProfileHoverCard>
                <ProfileHoverCard handle={post.author.handle}>
                  <span
                    className="max-w-[200px] cursor-pointer truncate hover:underline"
                    style={{ color: "var(--asph-text-secondary)" }}
                    onClick={handleAuthorClick}
                    {...authorPrefetchHandlers}
                  >
                    @{post.author.handle}
                  </span>
                </ProfileHoverCard>
                <DomainVerifiedBadgeInline handle={post.author.handle} />
                <span style={{ color: "var(--asph-text-secondary)" }}>·</span>
                <span
                  className="cursor-pointer text-sm hover:underline"
                  style={{ color: "var(--asph-text-secondary)" }}
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
                {isThreadMutedState && (
                  <>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      ·
                    </span>
                    <span
                      className="flex items-center gap-1 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                      title="Thread muted"
                    >
                      <BellOff size={14} aria-hidden="true" />
                      <span className="text-xs">Muted</span>
                    </span>
                  </>
                )}
              </div>
              {onMenuClick && (
                <button
                  onClick={onMenuClick}
                  className="rounded-full p-1 transition-colors hover:bg-asph-bg-hover"
                  aria-label="More options"
                  aria-haspopup="menu"
                >
                  <MoreVertical
                    size={16}
                    style={{ color: "var(--asph-text-secondary)" }}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {/* Post content */}
            <div className="mt-1 overflow-hidden">
              {/* Show labels if present */}
              {(post as any).labels && (post as any).labels.length > 0 && (
                <div className="mb-2">
                  <LabelBadge
                    labels={(post as any).labels}
                    maxDisplay={2}
                    size="sm"
                  />
                </div>
              )}
              <p
                className="whitespace-pre-wrap break-words"
                style={{ color: "var(--asph-text-primary)" }}
              >
                <RichText text={record?.text || ""} facets={record?.facets} />
              </p>
              {/* Inline Translation */}
              {isShowingTranslation && translatedText && (
                <div
                  className="mt-2 rounded-lg border-l-2 pl-3"
                  style={{
                    borderColor: "var(--asph-primary)",
                  }}
                >
                  <p
                    className="whitespace-pre-wrap break-words text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {translatedText}
                  </p>
                  <span
                    className="mt-1 block text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    Translated from {sourceLanguageName}
                  </span>
                </div>
              )}
              {translationError && (
                <div
                  className="mt-1 text-xs"
                  style={{ color: "var(--asph-danger, #ef4444)" }}
                >
                  Translation failed. Try again.
                </div>
              )}
              {showTranslateButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTranslate();
                  }}
                  className="mt-1 flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                  style={{ color: "var(--asph-primary)" }}
                  disabled={isTranslating}
                  aria-label={
                    isShowingTranslation
                      ? "Show original"
                      : `Translate from ${sourceLanguageName}`
                  }
                >
                  {isTranslating ? (
                    <Loader size={12} className="animate-spin" />
                  ) : (
                    <Globe size={12} aria-hidden="true" />
                  )}
                  <span>
                    {isTranslating
                      ? "Translating..."
                      : isShowingTranslation
                        ? "Show original"
                        : `Translate from ${sourceLanguageName}`}
                  </span>
                </button>
              )}
              {post.embed && renderEmbed(post.embed)}
              {/* If no embed but text contains URLs, try to render them */}
              {!post.embed && record?.text && (
                <>
                  <ExternalLinkEmbed text={record.text} />
                  <BskyUrlEmbed
                    text={record.text}
                    onQuoteClick={onQuoteClick}
                  />
                </>
              )}
              {/* Gate indicators */}
              <GateIndicator
                replyDisabled={post.viewer?.replyDisabled}
                embeddingDisabled={post.viewer?.embeddingDisabled}
                threadgate={post.threadgate}
                className="mt-2"
              />
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
                    if (!post.viewer?.replyDisabled) {
                      onReply?.();
                    }
                  }}
                  className={`flex items-center gap-1 text-sm transition-colors ${
                    post.viewer?.replyDisabled
                      ? "cursor-not-allowed opacity-40"
                      : "hover:text-blue-500"
                  }`}
                  style={{ color: "var(--asph-text-secondary)" }}
                  aria-label={
                    post.viewer?.replyDisabled
                      ? "Replies are restricted on this post"
                      : `Reply to post, ${post.replyCount || 0} replies`
                  }
                  aria-disabled={post.viewer?.replyDisabled}
                  title={
                    post.viewer?.replyDisabled
                      ? "Replies are restricted"
                      : undefined
                  }
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
                      : "var(--asph-text-secondary)",
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
                      : "var(--asph-text-secondary)",
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
                        : "var(--asph-text-secondary)",
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
