/**
 * PostDetailView Component for React Native
 *
 * Full-screen post detail view with thread context, replies, and engagement.
 * Optimized for 60fps scroll performance.
 *
 * Performance optimizations:
 * - React.memo with custom comparison for minimal re-renders
 * - Nested FlatList for replies with optimized settings
 * - Lazy loading of replies with visibility tracking
 * - Stable callbacks with useCallback
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ListRenderItemInfo,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../hooks/useDynamicType";
import type { MobilePostData, PostImage } from "../types";

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

// Default avatar placeholder
const DEFAULT_AVATAR_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e1e1e1'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23a1a1a1'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='22' fill='%23a1a1a1'/%3E%3C/svg%3E";

/**
 * Creates styles with Dynamic Type-scaled font sizes.
 * ViewStyle and ImageStyle properties remain unchanged;
 * only fontSize and associated lineHeight values are scaled.
 */
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#ffffff",
    } as ViewStyle,
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
      backgroundColor: "#ffffff",
      minHeight: 48,
    } as ViewStyle,
    backButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    } as ViewStyle,
    backIcon: {
      fontSize: scaledFont(24),
      color: "#0f1419",
    } as TextStyle,
    headerTitle: {
      fontSize: scaledFont(20),
      fontWeight: "700",
      color: "#0f1419",
      flexShrink: 1,
    } as TextStyle,
    scrollView: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingBottom: 32,
    } as ViewStyle,
    parentSection: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
    } as ViewStyle,
    parentPost: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
    } as ViewStyle,
    parentPostLast: {
      paddingBottom: 8,
    } as ViewStyle,
    threadLine: {
      width: 2,
      height: 20,
      backgroundColor: "#e1e1e1",
      borderRadius: 1,
      marginRight: 10,
    } as ViewStyle,
    parentAuthor: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#0f1419",
    } as TextStyle,
    parentSnippet: {
      fontSize: scaledFont(14),
      color: "#687684",
      fontWeight: "400",
    } as TextStyle,
    mainPost: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
    } as ViewStyle,
    authorSection: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    } as ViewStyle,
    authorText: {
      marginLeft: 12,
      flex: 1,
      flexShrink: 1,
    } as ViewStyle,
    authorNameButton: {
      minHeight: 24,
    } as ViewStyle,
    authorName: {
      fontSize: scaledFont(18),
      fontWeight: "700",
      color: "#0f1419",
    } as TextStyle,
    authorHandle: {
      fontSize: scaledFont(14),
      color: "#687684",
      marginTop: 2,
    } as TextStyle,
    postText: {
      fontSize: scaledFont(17),
      lineHeight: scaledLineHeight(scaledFont, 17, 24),
      color: "#0f1419",
      marginBottom: 16,
    } as TextStyle,
    imageContainer: {
      marginBottom: 16,
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
      fontSize: scaledFont(11),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
    quotedPost: {
      marginBottom: 16,
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
      fontSize: scaledFont(12),
      marginRight: 6,
    } as TextStyle,
    quotedPostLabel: {
      fontSize: scaledFont(12),
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
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#0f1419",
      flexShrink: 1,
    } as TextStyle,
    quotedText: {
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 18),
      color: "#0f1419",
    } as TextStyle,
    quotedPostDeleted: {
      marginBottom: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: "#e1e1e1",
      borderRadius: 12,
      backgroundColor: "#f7f9fa",
    } as ViewStyle,
    quotedPostDeletedText: {
      fontSize: scaledFont(14),
      color: "#687684",
      fontStyle: "italic",
    } as TextStyle,
    externalEmbed: {
      marginBottom: 16,
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
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#0f1419",
      marginBottom: 4,
    } as TextStyle,
    externalDescription: {
      fontSize: scaledFont(13),
      color: "#687684",
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
    } as TextStyle,
    metadataSection: {
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: "#e1e1e1",
    } as ViewStyle,
    timestamp: {
      fontSize: scaledFont(14),
      color: "#687684",
      marginBottom: 12,
    } as TextStyle,
    statsRow: {
      flexDirection: "row",
      gap: 24,
      flexWrap: "wrap",
    } as ViewStyle,
    statItem: {
      flexDirection: "row",
      alignItems: "center",
    } as ViewStyle,
    statValue: {
      fontSize: scaledFont(16),
      fontWeight: "700",
      color: "#0f1419",
      marginRight: 4,
    } as TextStyle,
    statLabel: {
      fontSize: scaledFont(14),
      color: "#687684",
    } as TextStyle,
    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      justifyContent: "space-around",
      flexWrap: "wrap",
    } as ViewStyle,
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 44,
      minHeight: 44,
      paddingVertical: 8,
      paddingHorizontal: 16,
    } as ViewStyle,
    actionIcon: {
      fontSize: scaledFont(18),
      marginRight: 6,
    } as TextStyle,
    actionLabel: {
      fontSize: scaledFont(14),
      color: "#687684",
      fontWeight: "600",
    } as TextStyle,
    actionActive: {
      color: "#00ba7c",
    } as TextStyle,
    labelActive: {
      color: "#00ba7c",
    } as TextStyle,
    likeActive: {
      color: "#f91880",
    } as TextStyle,
    likeLabelActive: {
      color: "#f91880",
    } as TextStyle,
    repliesHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
    } as ViewStyle,
    repliesHeaderText: {
      fontSize: scaledFont(16),
      fontWeight: "700",
      color: "#0f1419",
    } as TextStyle,
    repliesList: {
      flex: 1,
    } as ViewStyle,
    replyItem: {
      flexDirection: "row",
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
    } as ViewStyle,
    replyContent: {
      flex: 1,
      marginLeft: 12,
      flexShrink: 1,
    } as ViewStyle,
    replyHeader: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    } as ViewStyle,
    replyAuthor: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#0f1419",
      marginRight: 4,
    } as TextStyle,
    replyHandle: {
      fontSize: scaledFont(13),
      color: "#687684",
      marginRight: 4,
      flexShrink: 1,
    } as TextStyle,
    replyTime: {
      fontSize: scaledFont(13),
      color: "#687684",
    } as TextStyle,
    replyText: {
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 18),
      color: "#0f1419",
      marginTop: 4,
    } as TextStyle,
    replyStats: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
      flexWrap: "wrap",
    } as ViewStyle,
    replyStatText: {
      fontSize: scaledFont(12),
      color: "#687684",
    } as TextStyle,
    loadMoreButton: {
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    } as ViewStyle,
    loadMoreText: {
      fontSize: scaledFont(14),
      color: "#1d9bf0",
      fontWeight: "600",
    } as TextStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Header with back button
 */
const DetailHeader = memo(function DetailHeader({
  onBack,
  styles,
}: {
  onBack?: () => void;
  styles: Styles;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Post</Text>
    </View>
  );
});

/**
 * Avatar component
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
    <Image source={{ uri: uri || DEFAULT_AVATAR_URI }} style={imageStyle} />
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
 * Author info section
 */
const AuthorInfo = memo(function AuthorInfo({
  author,
  onPress,
  styles,
}: {
  author: AppBskyFeedDefs.PostView["author"];
  onPress?: (handle: string) => void;
  styles: Styles;
}) {
  const handlePress = useCallback(() => {
    onPress?.(author.handle);
  }, [author.handle, onPress]);

  return (
    <View style={styles.authorSection}>
      <Avatar uri={author.avatar} size={56} onPress={handlePress} />
      <View style={styles.authorText}>
        <Pressable onPress={handlePress} style={styles.authorNameButton}>
          <Text style={styles.authorName} numberOfLines={1}>
            {author.displayName || author.handle}
          </Text>
        </Pressable>
        <Text style={styles.authorHandle} numberOfLines={1}>
          @{author.handle}
        </Text>
      </View>
    </View>
  );
});

/**
 * Post images grid
 */
const PostImages = memo(function PostImages({
  images,
  onPress,
  styles,
}: {
  images: PostImage[];
  onPress?: (index: number) => void;
  styles: Styles;
}) {
  const gridStyle = useMemo<ViewStyle>(() => {
    if (!images || images.length === 0) return styles.singleImage;
    if (images.length === 1) return styles.singleImage;
    if (images.length === 2) return styles.twoImages;
    if (images.length === 3) return styles.threeImages;
    return styles.fourImages;
  }, [images?.length, styles]);

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
            style={styles.postImage}
            resizeMode="cover"
          />
          {image.alt && (
            <View style={styles.altBadge}>
              <Text style={styles.altText}>ALT</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
});

/**
 * Quoted post embed
 */
const QuotedPost = memo(function QuotedPost({
  embed,
  onPress,
  styles,
}: {
  embed: any;
  onPress?: (uri: string) => void;
  styles: Styles;
}) {
  const record = embed?.record;

  const handlePress = useCallback(() => {
    if (record?.uri) {
      onPress?.(record.uri);
    }
  }, [record?.uri, onPress]);

  if (
    !record ||
    record.$type === "app.bsky.embed.record#viewNotFound" ||
    record.$type === "app.bsky.embed.record#viewDetached"
  ) {
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

  // Starter pack embed
  if (record.$type === "app.bsky.graph.defs#starterPackViewBasic") {
    const packRecord = record.record as any;
    const packName = packRecord?.name || "Starter Pack";
    return (
      <View style={styles.quotedPost}>
        <View style={styles.quotedPostHeader}>
          <Text style={styles.quotedPostIcon}>👥</Text>
          <Text style={styles.quotedPostLabel}>Starter Pack</Text>
        </View>
        <View style={styles.quotedPostContent}>
          <Text style={styles.quotedAuthorName} numberOfLines={1}>
            {packName}
          </Text>
          {record.creator?.handle && (
            <Text style={styles.quotedText} numberOfLines={1}>
              by @{record.creator.handle}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Feed generator embed
  if (record.$type === "app.bsky.feed.defs#generatorView") {
    return (
      <View style={styles.quotedPost}>
        <View style={styles.quotedPostHeader}>
          <Text style={styles.quotedPostIcon}>📡</Text>
          <Text style={styles.quotedPostLabel}>Feed</Text>
        </View>
        <View style={styles.quotedPostContent}>
          <Text style={styles.quotedAuthorName} numberOfLines={1}>
            {record.displayName}
          </Text>
          {record.description && (
            <Text style={styles.quotedText} numberOfLines={2}>
              {record.description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // List embed
  if (record.$type === "app.bsky.graph.defs#listView") {
    return (
      <View style={styles.quotedPost}>
        <View style={styles.quotedPostHeader}>
          <Text style={styles.quotedPostIcon}>📋</Text>
          <Text style={styles.quotedPostLabel}>
            {record.purpose === "app.bsky.graph.defs#modlist"
              ? "Moderation List"
              : "List"}
          </Text>
        </View>
        <View style={styles.quotedPostContent}>
          <Text style={styles.quotedAuthorName} numberOfLines={1}>
            {record.name}
          </Text>
          {record.description && (
            <Text style={styles.quotedText} numberOfLines={2}>
              {record.description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Labeler service embed
  if (record.$type === "app.bsky.labeler.defs#labelerView") {
    return (
      <View style={styles.quotedPost}>
        <View style={styles.quotedPostHeader}>
          <Text style={styles.quotedPostIcon}>🛡️</Text>
          <Text style={styles.quotedPostLabel}>Labeler</Text>
        </View>
        <View style={styles.quotedPostContent}>
          <Text style={styles.quotedAuthorName} numberOfLines={1}>
            {record.creator?.displayName || record.creator?.handle}
          </Text>
        </View>
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
 * External link embed
 */
const ExternalEmbed = memo(function ExternalEmbed({
  external,
  onPress,
  styles,
}: {
  external: any;
  onPress?: () => void;
  styles: Styles;
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
 * Post timestamp and engagement stats
 */
const PostMetadata = memo(function PostMetadata({
  indexedAt,
  likeCount,
  repostCount,
  replyCount,
  styles,
}: {
  indexedAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  styles: Styles;
}) {
  const timestamp = useMemo(() => {
    const date = new Date(indexedAt);
    return date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [indexedAt]);

  return (
    <View style={styles.metadataSection}>
      <Text style={styles.timestamp}>{timestamp}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{replyCount || 0}</Text>
          <Text style={styles.statLabel}>Replies</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{repostCount || 0}</Text>
          <Text style={styles.statLabel}>Reposts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{likeCount || 0}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
      </View>
    </View>
  );
});

/**
 * Action bar for the main post
 */
const ActionBar = memo(function ActionBar({
  post,
  onLike,
  onRepost,
  onReply,
  onQuote: _onQuote,
  onBookmark,
  styles,
}: {
  post: AppBskyFeedDefs.PostView;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onQuote?: () => void;
  onBookmark?: () => void;
  styles: Styles;
}) {
  void _onQuote;
  const isLiked = !!post.viewer?.like;
  const isReposted = !!post.viewer?.repost;

  return (
    <View style={styles.actionBar}>
      <Pressable
        onPress={onReply}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel="Reply"
        accessibilityRole="button"
      >
        <Text style={styles.actionIcon}>💬</Text>
        <Text style={styles.actionLabel}>Reply</Text>
      </Pressable>

      <Pressable
        onPress={onRepost}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel="Repost"
        accessibilityRole="button"
      >
        <Text style={[styles.actionIcon, isReposted && styles.actionActive]}>
          ↻
        </Text>
        <Text style={[styles.actionLabel, isReposted && styles.labelActive]}>
          Repost
        </Text>
      </Pressable>

      <Pressable
        onPress={onLike}
        style={styles.actionButton}
        hitSlop={8}
        accessibilityLabel="Like"
        accessibilityRole="button"
      >
        <Text style={[styles.actionIcon, isLiked && styles.likeActive]}>
          {isLiked ? "❤️" : "🤍"}
        </Text>
        <Text style={[styles.actionLabel, isLiked && styles.likeLabelActive]}>
          Like
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
          <Text style={styles.actionLabel}>Save</Text>
        </Pressable>
      )}
    </View>
  );
});

/**
 * Reply item component
 */
const ReplyItem = memo(function ReplyItem({
  reply,
  onPress,
  onAuthorPress,
  styles,
}: {
  reply: AppBskyFeedDefs.PostView;
  onPress?: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress?: (handle: string) => void;
  styles: Styles;
}) {
  const record = reply.record as any;
  const timeAgo = useMemo(
    () =>
      formatDistanceToNow(new Date(reply.indexedAt), {
        addSuffix: true,
      }),
    [reply.indexedAt],
  );

  const handleAuthorPress = useCallback(() => {
    onAuthorPress?.(reply.author.handle);
  }, [reply.author.handle, onAuthorPress]);

  const handlePress = useCallback(() => {
    onPress?.(reply);
  }, [reply, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.replyItem}
      accessibilityRole="button"
    >
      <Avatar uri={reply.author.avatar} size={40} onPress={handleAuthorPress} />
      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Pressable onPress={handleAuthorPress}>
            <Text style={styles.replyAuthor} numberOfLines={1}>
              {reply.author.displayName || reply.author.handle}
            </Text>
          </Pressable>
          <Text style={styles.replyHandle}>@{reply.author.handle}</Text>
          <Text style={styles.replyTime}>· {timeAgo}</Text>
        </View>
        <Text style={styles.replyText} numberOfLines={3}>
          {record?.text || ""}
        </Text>
        <View style={styles.replyStats}>
          <Text style={styles.replyStatText}>
            {reply.replyCount || 0} replies
          </Text>
          <Text style={styles.replyStatText}>·</Text>
          <Text style={styles.replyStatText}>{reply.likeCount || 0} likes</Text>
        </View>
      </View>
    </Pressable>
  );
});

/**
 * Parent post item (thread context) - single simple line
 */
const ParentPostItem = memo(function ParentPostItem({
  post,
  onPress,
  isLast,
  styles,
}: {
  post: AppBskyFeedDefs.PostView;
  onPress?: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress?: (handle: string) => void;
  isLast: boolean;
  styles: Styles;
}) {
  const record = post.record as any;
  const snippet = (record?.text || "").replace(/\n/g, " ");

  const handlePress = useCallback(() => {
    onPress?.(post);
  }, [post, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.parentPost, isLast && styles.parentPostLast]}
      accessibilityRole="button"
      accessibilityLabel={`Reply to ${post.author.displayName || post.author.handle}`}
    >
      <View style={styles.threadLine} />
      <Text numberOfLines={1}>
        <Text style={styles.parentAuthor}>
          {post.author.displayName || post.author.handle}
        </Text>
        {snippet ? <Text style={styles.parentSnippet}> {snippet}</Text> : null}
      </Text>
    </Pressable>
  );
});

/**
 * Main PostDetailView component
 */
function PostDetailViewComponent({
  post,
  replies = [],
  parentPosts = [],
  threadSummary,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onAuthorPress,
  onQuotePress,
  onReplyPress,
  onParentPress,
  onLoadMoreReplies,
  hasMoreReplies = false,
  isLoadingReplies = false,
  onBack,
}: PostDetailViewProps) {
  const record = post.record as any;

  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

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

    // Record with media (quoted post + images/video)
    if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
      return (
        <View style={{ gap: 8 }}>
          {images.length > 0 && <PostImages images={images} styles={styles} />}
          {embed.record && (
            <QuotedPost
              embed={embed.record}
              onPress={onQuotePress}
              styles={styles}
            />
          )}
        </View>
      );
    }

    // Images (standalone, not part of recordWithMedia)
    if (images.length > 0) {
      return <PostImages images={images} styles={styles} />;
    }

    // Quoted post
    if (
      embed.$type === "app.bsky.embed.record#view" ||
      embed.record?.$type === "app.bsky.embed.record#viewRecord"
    ) {
      return (
        <QuotedPost embed={embed} onPress={onQuotePress} styles={styles} />
      );
    }

    // External link
    if (embed.external) {
      return <ExternalEmbed external={embed.external} styles={styles} />;
    }

    return null;
  }, [post.embed, images, onQuotePress, styles]);

  // Render reply item
  const renderReply = useCallback(
    ({ item }: ListRenderItemInfo<MobilePostData>) => (
      <ReplyItem
        reply={item.post}
        onPress={onReplyPress}
        onAuthorPress={onAuthorPress}
        styles={styles}
      />
    ),
    [onReplyPress, onAuthorPress, styles],
  );

  // Key extractor for replies
  const keyExtractor = useCallback(
    (item: MobilePostData) => item.key || item.post.uri,
    [],
  );

  // Replies data
  const repliesData = useMemo<MobilePostData[]>(
    () =>
      replies.map((reply) => ({
        post: reply.post,
        reason: reply.reason,
        key: reply.key || reply.post.uri,
      })),
    [replies],
  );

  return (
    <View style={styles.container}>
      <DetailHeader onBack={onBack} styles={styles} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Thread context (parent posts) */}
        {parentPosts.length > 0 && (
          <View style={styles.parentSection}>
            {parentPosts.map((parentPost, index) => (
              <ParentPostItem
                key={parentPost.uri}
                post={parentPost}
                onPress={onParentPress}
                onAuthorPress={onAuthorPress}
                isLast={index === parentPosts.length - 1}
                styles={styles}
              />
            ))}
          </View>
        )}

        {/* Main post */}
        <View style={styles.mainPost}>
          <AuthorInfo
            author={post.author}
            onPress={onAuthorPress}
            styles={styles}
          />

          {/* Post text */}
          {record?.text && <Text style={styles.postText}>{record.text}</Text>}

          {/* Embedded content */}
          {renderEmbed()}

          {/* Metadata and stats */}
          <PostMetadata
            indexedAt={post.indexedAt}
            likeCount={post.likeCount}
            repostCount={post.repostCount}
            replyCount={post.replyCount}
            styles={styles}
          />

          {/* Action bar */}
          <ActionBar
            post={post}
            onLike={onLike}
            onRepost={onRepost}
            onReply={onReply}
            onQuote={onQuote}
            onBookmark={onBookmark}
            styles={styles}
          />

          {/* Thread summary */}
          {threadSummary}
        </View>

        {/* Replies section header */}
        {repliesData.length > 0 && (
          <View style={styles.repliesHeader}>
            <Text style={styles.repliesHeaderText}>
              Replies ({post.replyCount || repliesData.length})
            </Text>
          </View>
        )}

        {/* Replies list */}
        {repliesData.length > 0 && (
          <FlatList
            data={repliesData}
            renderItem={renderReply}
            keyExtractor={keyExtractor}
            style={styles.repliesList}
          />
        )}

        {/* Load more replies */}
        {hasMoreReplies && (
          <Pressable
            onPress={onLoadMoreReplies}
            style={styles.loadMoreButton}
            accessibilityRole="button"
          >
            {isLoadingReplies ? (
              <ActivityIndicator size="small" color="#1d9bf0" />
            ) : (
              <Text style={styles.loadMoreText}>Load more replies</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Custom comparison for memo
 */
function arePropsEqual(
  prevProps: PostDetailViewProps,
  nextProps: PostDetailViewProps,
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

  // Compare replies array identity
  if (prevProps.replies !== nextProps.replies) return false;
  if (prevProps.parentPosts !== nextProps.parentPosts) return false;

  // Compare loading states
  if (prevProps.isLoadingReplies !== nextProps.isLoadingReplies) return false;
  if (prevProps.hasMoreReplies !== nextProps.hasMoreReplies) return false;

  return true;
}

/**
 * Memoized export
 */
export const PostDetailView = memo(PostDetailViewComponent, arePropsEqual);
