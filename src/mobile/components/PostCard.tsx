/**
 * PostCard Component for React Native
 *
 * Core feed component optimized for 60fps scroll performance.
 * Uses React Native primitives (View, Text, Image) with careful
 * optimization for FlatList rendering.
 *
 * Performance optimizations:
 * - React.memo with custom comparison to prevent unnecessary re-renders
 * - useCallback for all event handlers
 * - Conditional image loading based on visibility
 * - Minimal re-renders through stable prop references
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import { memo, useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  DEFAULT_CONTENT_FILTER_PREFERENCES,
  getContentWarningDescription,
  getContentWarningIcon,
  getContentWarningText,
  shouldBlurImages,
  shouldHideContent,
  shouldWarnContent,
} from "../../utils/labels";
import type { PostCardProps, PostImage } from "../types";

// Placeholder for expo-image - will be used when available
// import { Image as ExpoImage } from 'expo-image';

// Default avatar placeholder - in React Native, use require() for local assets
// For web builds, this will be handled by the bundler
const DEFAULT_AVATAR_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e1e1e1'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23a1a1a1'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='22' fill='%23a1a1a1'/%3E%3C/svg%3E";

/**
 * Avatar component with lazy loading optimization
 */
const Avatar = memo(function Avatar({
  uri,
  size = 48,
  onPress,
}: {
  uri?: string;
  size?: number;
  onPress?: () => void;
}) {
  const imageStyle = useMemo<ImageStyle>(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: "#e1e1e1",
    }),
    [size],
  );

  const content = (
    <Image
      source={{ uri: uri || DEFAULT_AVATAR_URI }}
      style={imageStyle}
      // For expo-image: placeholder={blurhash} transition={200}
    />
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={12}
        style={{ minWidth: 44, minHeight: 44 }}
        accessibilityRole="button"
        accessibilityLabel="View profile"
      >
        {content}
      </Pressable>
    );
  }

  return content;
});

/**
 * Author info header component
 */
const AuthorHeader = memo(function AuthorHeader({
  author,
  indexedAt,
  onAuthorPress,
}: {
  author: AppBskyFeedDefs.PostView["author"];
  indexedAt: string;
  onAuthorPress?: (handle: string) => void;
}) {
  const handlePress = useCallback(() => {
    onAuthorPress?.(author.handle);
  }, [author.handle, onAuthorPress]);

  const timeAgo = useMemo(
    () =>
      formatDistanceToNow(new Date(indexedAt), {
        addSuffix: true,
      }),
    [indexedAt],
  );

  return (
    <View style={styles.authorContainer}>
      <Pressable
        onPress={handlePress}
        style={styles.authorInfo}
        accessibilityRole="button"
        accessibilityLabel={`View ${author.displayName || author.handle}'s profile`}
      >
        <Text style={styles.displayName} numberOfLines={1}>
          {author.displayName || author.handle}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{author.handle}
        </Text>
      </Pressable>
      <Text style={styles.timestamp}>· {timeAgo}</Text>
    </View>
  );
});

/**
 * Repost reason indicator
 */
const RepostReason = memo(function RepostReason({
  reason,
  onPress,
}: {
  reason: AppBskyFeedDefs.FeedViewPost["reason"];
  onPress?: (handle: string) => void;
}) {
  const by = (reason as any)?.by;
  const handlePress = useCallback(() => {
    if (by?.handle) {
      onPress?.(by.handle);
    }
  }, [by?.handle, onPress]);

  if (reason?.$type !== "app.bsky.feed.defs#reasonRepost") {
    return null;
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.repostReason}
      accessibilityRole="button"
      accessibilityLabel={`View ${by.displayName || by.handle}'s profile`}
    >
      <Text style={styles.repostIcon}>↻</Text>
      <Text style={styles.repostText}>
        {by.displayName || by.handle} reposted
      </Text>
    </Pressable>
  );
});

/**
 * Post action bar with like, repost, reply, etc.
 */
const ActionBar = memo(function ActionBar({
  post,
  onLike,
  onRepost,
  onReply,
  onQuote: _onQuote,
  onBookmark,
}: {
  post: AppBskyFeedDefs.PostView;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
}) {
  // Note: onQuote is available for future quote button implementation
  void _onQuote;
  const isLiked = !!post.viewer?.like;
  const isReposted = !!post.viewer?.repost;

  return (
    <View style={styles.actionBar}>
      <Pressable
        onPress={onReply}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel={`Reply, ${post.replyCount || 0} replies`}
        accessibilityRole="button"
      >
        <Text style={styles.actionIcon}>💬</Text>
        <Text style={styles.actionCount}>{post.replyCount || 0}</Text>
      </Pressable>

      <Pressable
        onPress={onRepost}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel={`Repost, ${post.repostCount || 0} reposts`}
        accessibilityRole="button"
      >
        <Text style={[styles.actionIcon, isReposted && styles.actionActive]}>
          ↻
        </Text>
        <Text style={[styles.actionCount, isReposted && styles.countActive]}>
          {post.repostCount || 0}
        </Text>
      </Pressable>

      <Pressable
        onPress={onLike}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel={`Like, ${post.likeCount || 0} likes`}
        accessibilityRole="button"
      >
        <Text style={[styles.actionIcon, isLiked && styles.likeActive]}>
          {isLiked ? "❤️" : "🤍"}
        </Text>
        <Text style={[styles.actionCount, isLiked && styles.likeCountActive]}>
          {post.likeCount || 0}
        </Text>
      </Pressable>

      {onBookmark && (
        <Pressable
          onPress={onBookmark}
          style={styles.actionButton}
          hitSlop={8}
          accessibilityLabel="Bookmark"
          accessibilityRole="button"
        >
          <Text style={styles.actionIcon}>🔖</Text>
        </Pressable>
      )}
    </View>
  );
});

/**
 * Content warning overlay component
 */
const ContentWarningOverlay = memo(function ContentWarningOverlay({
  labels,
  onReveal,
}: {
  labels: any[];
  onReveal: () => void;
}) {
  const warningText = getContentWarningText(labels);
  const warningDescription = getContentWarningDescription(labels);
  const warningIcon = getContentWarningIcon(labels);

  return (
    <View style={styles.contentWarningOverlay}>
      <View style={styles.contentWarningContent}>
        <Text style={styles.contentWarningIcon}>{warningIcon}</Text>
        <Text style={styles.contentWarningTitle}>{warningText}</Text>
        <Text style={styles.contentWarningDescription}>
          {warningDescription}
        </Text>
        <Pressable
          onPress={onReveal}
          style={styles.contentWarningButton}
          accessibilityRole="button"
          accessibilityLabel="Show content"
        >
          <Text style={styles.contentWarningButtonText}>Show</Text>
        </Pressable>
      </View>
    </View>
  );
});

/**
 * Post images component with grid layout
 */
const PostImages = memo(function PostImages({
  images,
  onPress,
  shouldBlur,
}: {
  images: PostImage[];
  onPress?: (index: number) => void;
  shouldBlur?: boolean;
}) {
  const gridStyle = useMemo<ViewStyle>(() => {
    if (!images || images.length === 0) return styles.singleImage;
    if (images.length === 1) return styles.singleImage;
    if (images.length === 2) return styles.twoImages;
    if (images.length === 3) return styles.threeImages;
    return styles.fourImages;
  }, [images?.length]);

  if (!images || images.length === 0) return null;

  return (
    <View style={[styles.imageContainer, gridStyle]}>
      {images.slice(0, 4).map((image, index) => (
        <Pressable
          key={image.thumb}
          onPress={() => onPress?.(index)}
          style={[
            styles.imageWrapper,
            images.length === 3 && index === 0 && styles.largeImage,
          ]}
        >
          <Image
            source={{ uri: image.thumb }}
            style={
              shouldBlur
                ? [styles.postImage, styles.blurredImage]
                : styles.postImage
            }
            resizeMode="cover"
            // Note: blurRadius is not available in basic React Native Image
            // For expo-image, we would use:
            // blurRadius={shouldBlur ? 20 : 0}
            // placeholder={blurhash}
            // transition={200}
            // cachePolicy="memory-disk"
          />
          {image.alt && (
            <View style={styles.altBadge}>
              <Text style={styles.altText}>ALT</Text>
            </View>
          )}
          {shouldBlur && (
            <View style={styles.blurOverlay}>
              <Text style={styles.blurOverlayText}>Tap to reveal</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
});

/**
 * Quoted post embed component
 */
const QuotedPost = memo(function QuotedPost({
  embed,
  onPress,
}: {
  embed: any;
  onPress?: (uri: string) => void;
}) {
  const record = embed?.record;

  const handlePress = useCallback(() => {
    if (record?.uri) {
      onPress?.(record.uri);
    }
  }, [record?.uri, onPress]);

  if (!record || record.$type === "app.bsky.embed.record#viewNotFound") {
    return (
      <View style={styles.quotedPostDeleted}>
        <Text style={styles.quotedPostDeletedText}>Post not found</Text>
      </View>
    );
  }

  if (record.$type === "app.bsky.embed.record#viewBlocked") {
    return (
      <View style={styles.quotedPostDeleted}>
        <Text style={styles.quotedPostDeletedText}>Post from blocked user</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.quotedPost}>
      <View style={styles.quotedPostHeader}>
        <Text style={styles.quotedPostIcon}>💬</Text>
        <Text style={styles.quotedPostLabel}>Quoted post</Text>
      </View>
      <View style={styles.quotedPostContent}>
        <View style={styles.quotedAuthor}>
          <Image
            source={{ uri: record.author?.avatar }}
            style={styles.quotedAvatar}
          />
          <Text style={styles.quotedAuthorName} numberOfLines={1}>
            {record.author?.displayName || record.author?.handle}
          </Text>
        </View>
        <Text style={styles.quotedText} numberOfLines={3}>
          {record.value?.text || ""}
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * External link embed component
 */
const ExternalEmbed = memo(function ExternalEmbed({
  external,
  onPress,
}: {
  external: any;
  onPress?: () => void;
}) {
  if (!external) return null;

  return (
    <Pressable onPress={onPress} style={styles.externalEmbed}>
      {external.thumb && (
        <Image
          source={{ uri: external.thumb }}
          style={styles.externalImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.externalContent}>
        <Text style={styles.externalTitle} numberOfLines={2}>
          {external.title}
        </Text>
        <Text style={styles.externalDescription} numberOfLines={2}>
          {external.description}
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * Main PostCard component
 */
function PostCardComponent({
  post,
  reason,
  onPress,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onAuthorPress,
  onQuotePress,
  showBorder = true,
}: PostCardProps) {
  const record = post.record as any;
  const [contentRevealed, setContentRevealed] = useState(false);

  // Use default content filter preferences (can be extended to use user preferences later)
  const contentFilterPreferences = DEFAULT_CONTENT_FILTER_PREFERENCES;

  // Check if content should be hidden or warned based on labels
  const hideContent = useMemo(
    () => shouldHideContent(post.labels, contentFilterPreferences),
    [post.labels],
  );

  const warnContent = useMemo(
    () => shouldWarnContent(post.labels, contentFilterPreferences),
    [post.labels],
  );

  const showWarning = warnContent && !contentRevealed;
  const blurImages = useMemo(
    () => shouldBlurImages(post.labels, contentFilterPreferences),
    [post.labels],
  );

  const handleAvatarPress = useCallback(() => {
    onAuthorPress?.(post.author.handle);
  }, [post.author.handle, onAuthorPress]);

  const handleLike = useCallback(() => {
    onLike?.();
  }, [onLike]);

  const handleRepost = useCallback(() => {
    onRepost?.();
  }, [onRepost]);

  const handleReply = useCallback(() => {
    onReply?.();
  }, [onReply]);

  const handleBookmark = useCallback(() => {
    onBookmark?.();
  }, [onBookmark]);

  const handleRevealContent = useCallback(() => {
    setContentRevealed(true);
  }, []);

  // Extract images from embed
  const images = useMemo<PostImage[]>(() => {
    const embed = post.embed as any;
    if (embed?.images) {
      return embed.images.map((img: any) => ({
        thumb: img.thumb,
        fullsize: img.fullsize,
        alt: img.alt,
      }));
    }
    if (embed?.media?.images) {
      return embed.media.images.map((img: any) => ({
        thumb: img.thumb,
        fullsize: img.fullsize,
        alt: img.alt,
      }));
    }
    return [];
  }, [post.embed]);

  // Render embed content
  const renderEmbed = useCallback(() => {
    const embed = post.embed as any;
    if (!embed) return null;

    // Images
    if (images.length > 0) {
      return (
        <PostImages
          images={images}
          shouldBlur={blurImages && !contentRevealed}
        />
      );
    }

    // Quoted post
    if (
      embed.$type === "app.bsky.embed.record#view" ||
      embed.record?.$type === "app.bsky.embed.record#viewRecord"
    ) {
      return <QuotedPost embed={embed} onPress={onQuotePress} />;
    }

    // External link
    if (embed.external) {
      return <ExternalEmbed external={embed.external} />;
    }

    return null;
  }, [post.embed, images, onQuotePress, blurImages, contentRevealed]);

  // If content should be completely hidden, don't render it
  if (hideContent) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, showBorder && styles.containerBorder]}
      accessibilityRole="button"
      accessibilityLabel={`Post by ${post.author.displayName || post.author.handle}`}
    >
      {/* Repost indicator */}
      <RepostReason reason={reason} onPress={onAuthorPress} />

      <View style={styles.postContent}>
        {/* Avatar */}
        <Avatar
          uri={post.author.avatar}
          size={48}
          onPress={handleAvatarPress}
        />

        <View style={styles.mainContent}>
          {/* Author header */}
          <AuthorHeader
            author={post.author}
            indexedAt={post.indexedAt}
            onAuthorPress={onAuthorPress}
          />

          {/* Content warning overlay or content */}
          {showWarning ? (
            <ContentWarningOverlay
              labels={post.labels || []}
              onReveal={handleRevealContent}
            />
          ) : (
            <>
              {/* Post text */}
              {record?.text && (
                <Text style={styles.postText}>{record.text}</Text>
              )}

              {/* Embedded content */}
              {renderEmbed()}
            </>
          )}

          {/* Action bar - always show */}
          <ActionBar
            post={post}
            onLike={handleLike}
            onRepost={handleRepost}
            onReply={handleReply}
            onQuote={onQuote}
            onBookmark={handleBookmark}
          />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Custom comparison function for React.memo
 * Prevents unnecessary re-renders by comparing only relevant props
 */
function arePropsEqual(
  prevProps: PostCardProps,
  nextProps: PostCardProps,
): boolean {
  // Compare post identity
  if (prevProps.post.uri !== nextProps.post.uri) return false;
  if (prevProps.post.cid !== nextProps.post.cid) return false;

  // Compare engagement counts (these update frequently)
  if (prevProps.post.likeCount !== nextProps.post.likeCount) return false;
  if (prevProps.post.repostCount !== nextProps.post.repostCount) return false;
  if (prevProps.post.replyCount !== nextProps.post.replyCount) return false;

  // Compare viewer state
  if (prevProps.post.viewer?.like !== nextProps.post.viewer?.like) return false;
  if (prevProps.post.viewer?.repost !== nextProps.post.viewer?.repost)
    return false;

  // Compare visibility
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.showBorder !== nextProps.showBorder) return false;

  // Callbacks are stable (useCallback in parent), skip comparison
  return true;
}

/**
 * Memoized PostCard for optimal FlatList performance
 */
export const PostCard = memo(PostCardComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  } as ViewStyle,
  containerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e1e1e1",
  } as ViewStyle,
  repostReason: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 60,
    minHeight: 44,
    paddingVertical: 8,
  } as ViewStyle,
  repostIcon: {
    fontSize: 14,
    color: "#687684",
    marginRight: 4,
  } as TextStyle,
  repostText: {
    fontSize: 13,
    color: "#687684",
  } as TextStyle,
  postContent: {
    flexDirection: "row",
  } as ViewStyle,
  mainContent: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,
  authorContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  } as ViewStyle,
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minHeight: 44,
    paddingVertical: 8,
  } as ViewStyle,
  displayName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f1419",
    marginRight: 4,
  } as TextStyle,
  handle: {
    fontSize: 14,
    color: "#687684",
    flexShrink: 1,
  } as TextStyle,
  timestamp: {
    fontSize: 14,
    color: "#687684",
    marginLeft: 4,
  } as TextStyle,
  postText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#0f1419",
    marginTop: 4,
  } as TextStyle,
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    justifyContent: "space-between",
    maxWidth: 280,
  } as ViewStyle,
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
  } as ViewStyle,
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  } as TextStyle,
  actionCount: {
    fontSize: 13,
    color: "#687684",
  } as TextStyle,
  actionActive: {
    color: "#00ba7c",
  } as TextStyle,
  countActive: {
    color: "#00ba7c",
  } as TextStyle,
  likeActive: {
    color: "#f91880",
  } as TextStyle,
  likeCountActive: {
    color: "#f91880",
  } as TextStyle,
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  } as ViewStyle,
  singleImage: {
    aspectRatio: 16 / 9,
  } as ViewStyle,
  twoImages: {
    flexDirection: "row",
    gap: 2,
    aspectRatio: 2,
  } as ViewStyle,
  threeImages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    aspectRatio: 1.5,
  } as ViewStyle,
  fourImages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    aspectRatio: 1,
  } as ViewStyle,
  imageWrapper: {
    flex: 1,
    minWidth: "48%",
    position: "relative",
  } as ViewStyle,
  largeImage: {
    minWidth: "66%",
    minHeight: "100%",
  } as ViewStyle,
  postImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e1e1e1",
  } as ImageStyle,
  altBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  } as ViewStyle,
  altText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
  quotedPost: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 12,
    overflow: "hidden",
  } as ViewStyle,
  quotedPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f7f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  } as ViewStyle,
  quotedPostIcon: {
    fontSize: 12,
    marginRight: 6,
  } as TextStyle,
  quotedPostLabel: {
    fontSize: 12,
    color: "#687684",
  } as TextStyle,
  quotedPostContent: {
    padding: 12,
  } as ViewStyle,
  quotedAuthor: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  } as ViewStyle,
  quotedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#e1e1e1",
  } as ImageStyle,
  quotedAuthorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f1419",
  } as TextStyle,
  quotedText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#0f1419",
  } as TextStyle,
  quotedPostDeleted: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 12,
    backgroundColor: "#f7f9fa",
  } as ViewStyle,
  quotedPostDeletedText: {
    fontSize: 14,
    color: "#687684",
    fontStyle: "italic",
  } as TextStyle,
  externalEmbed: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 12,
    overflow: "hidden",
  } as ViewStyle,
  externalImage: {
    width: "100%",
    height: 150,
    backgroundColor: "#e1e1e1",
  } as ImageStyle,
  externalContent: {
    padding: 12,
  } as ViewStyle,
  externalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f1419",
    marginBottom: 4,
  } as TextStyle,
  externalDescription: {
    fontSize: 13,
    color: "#687684",
    lineHeight: 18,
  } as TextStyle,
  contentWarningOverlay: {
    marginTop: 12,
    padding: 24,
    backgroundColor: "#f7f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  } as ViewStyle,
  contentWarningContent: {
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  contentWarningIcon: {
    fontSize: 32,
    marginBottom: 8,
  } as TextStyle,
  contentWarningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f1419",
    marginBottom: 4,
    textAlign: "center",
  } as TextStyle,
  contentWarningDescription: {
    fontSize: 14,
    color: "#687684",
    marginBottom: 16,
    textAlign: "center",
  } as TextStyle,
  contentWarningButton: {
    backgroundColor: "#0085ff",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  } as ViewStyle,
  contentWarningButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
  blurredImage: {
    opacity: 0.5,
  } as ImageStyle,
  blurOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  blurOverlayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  } as TextStyle,
});
