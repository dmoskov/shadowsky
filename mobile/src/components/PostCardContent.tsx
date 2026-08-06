import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  AppBskyRichtextFacet,
} from "@atproto/api";
import { Avatar } from "./Avatar";
import { postEdit } from "@bsky/core";
import { ReplyIcon, MoreIcon, TranslateIcon, ShieldIcon, PenIcon } from "./icons";
import { RichText } from "../utils/rich-text";
import { PostEmbed } from "./PostEmbed";
import { InlineErrorBoundary } from "./ui/InlineErrorBoundary";
import { PostCardActions } from "./PostCardActions";
import { fontSize } from "../utils/typography";

interface PostCardContentProps {
  post: AppBskyFeedDefs.FeedViewPost;
  postView: AppBskyFeedDefs.PostView;
  author: AppBskyActorDefs.ProfileViewBasic;
  record: AppBskyFeedPost.Record | undefined;
  timestamp: string;
  colors: any;
  isOnline: boolean;
  isOwnPost: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  isVisible: boolean;
  blurImages: boolean;
  labels: any[];
  hideContent: boolean;
  // Animation styles
  likeAnimStyle: any;
  repostAnimStyle: any;
  bookmarkAnimStyle: any;
  // Translation
  translation: {
    showTranslateButton: boolean;
    isTranslating: boolean;
    translatedText: string | null;
    isShowingTranslation: boolean;
    translationError: string | null;
    sourceLanguageName: string;
    handleTranslate: () => void;
  };
  // Handlers
  handleProfilePress: () => void;
  handleMorePress: () => void;
  handleLikePress: () => void;
  handleRepostPress: () => void;
  handleBookmarkPress: () => void;
  handleBookmarkLongPress: () => void;
  handleShare: () => void;
  // Callback props
  onReply?: () => void;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  onImagePress?: (
    images: Array<{ thumb: string; fullsize: string; alt?: string }>,
    index: number,
  ) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  onPressProfile?: (handle: string) => void;
  onPressLikeCount?: () => void;
  onPressRepostCount?: () => void;
}

export function PostCardContent({
  post,
  postView,
  author,
  record,
  timestamp,
  colors,
  isOnline,
  isOwnPost,
  isLiked,
  isBookmarked,
  isVisible,
  blurImages,
  labels,
  hideContent,
  likeAnimStyle,
  repostAnimStyle,
  bookmarkAnimStyle,
  translation,
  handleProfilePress,
  handleMorePress,
  handleLikePress,
  handleRepostPress,
  handleBookmarkPress,
  handleBookmarkLongPress,
  handleShare,
  onReply,
  onMentionPress,
  onHashtagPress,
  onImagePress,
  onLinkPress,
  onQuotePress,
  onPressProfile,
  onPressLikeCount,
  onPressRepostCount,
}: PostCardContentProps) {
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const editedAt = postEdit.getEditedAt(record);
  const originalText = postEdit.getOriginalText(record);
  const [showOriginal, setShowOriginal] = React.useState(false);

  return (
    <View style={styles.content}>
      {/* Reply Context */}
      {post.reply?.parent && AppBskyFeedDefs.isPostView(post.reply.parent) && (
        <TouchableOpacity
          style={styles.replyContext}
          onPress={() => {
            const parentAuthor = (
              post.reply!.parent as AppBskyFeedDefs.PostView
            ).author;
            onPressProfile?.(parentAuthor.handle);
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Replying to @${(post.reply.parent as AppBskyFeedDefs.PostView).author.handle}`}
        >
          <View style={styles.replyContextBar} />
          <View style={styles.replyContextBody}>
            <View style={styles.replyContextHeader}>
              <ReplyIcon size={12} color={colors.textTertiary} />
              <Text style={styles.replyContextText}>
                Replying to{" "}
                <Text style={styles.replyContextHandle}>
                  @
                  {
                    (post.reply.parent as AppBskyFeedDefs.PostView).author
                      .handle
                  }
                </Text>
              </Text>
            </View>
            {!!(
              (post.reply.parent as AppBskyFeedDefs.PostView).record as {
                text?: string;
              }
            )?.text && (
              <Text style={styles.replyContextPreview} numberOfLines={6}>
                "
                {
                  (
                    (post.reply.parent as AppBskyFeedDefs.PostView).record as {
                      text?: string;
                    }
                  ).text
                }
                "
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Author Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorSection}
          onPress={handleProfilePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View profile of ${author.displayName || author.handle}`}
          accessibilityHint="Double tap to open profile"
        >
          <Avatar
            uri={author.avatar}
            size={44}
            accessibilityLabel={`${author.displayName || author.handle}'s avatar`}
          />
          <View style={styles.authorInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {author.displayName || author.handle}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{author.handle}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.timestamp}>{timestamp}</Text>
          {editedAt && (
            originalText ? (
              <TouchableOpacity
                style={styles.editedBadge}
                onPress={() => setShowOriginal((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Edited — ${showOriginal ? "hide" : "show"} original text`}
                accessibilityState={{ expanded: showOriginal }}
              >
                <PenIcon size={11} color={colors.textTertiary} />
                <Text style={styles.editedText}>Edited</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editedBadge}>
                <PenIcon size={11} color={colors.textTertiary} />
                <Text style={styles.editedText}>Edited</Text>
              </View>
            )
          )}
          {labels.length > 0 && !hideContent && (
            <ShieldIcon
              size={14}
              color={colors.warning}
              accessibilityLabel="This post has content labels"
            />
          )}
          {isOnline && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={handleMorePress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More options"
              accessibilityHint={
                isOwnPost
                  ? "Double tap to open menu with delete option"
                  : "Double tap to open menu with mute, block, and report options"
              }
            >
              <MoreIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Post Text */}
      {record && typeof record.text === "string" && (
        <InlineErrorBoundary silent context="RichText">
          <RichText
            text={record.text}
            facets={record.facets as AppBskyRichtextFacet.Main[] | undefined}
            onMentionPress={onMentionPress}
            onHashtagPress={onHashtagPress}
            style={styles.text}
          />
        </InlineErrorBoundary>
      )}

      {/* Original text (pre-edit) */}
      {showOriginal && originalText && (
        <View style={styles.originalTextContainer}>
          <Text style={styles.originalTextContent}>{originalText}</Text>
          <Text style={styles.originalTextLabel}>Original text</Text>
        </View>
      )}

      {/* Inline Translation */}
      {translation.isShowingTranslation && translation.translatedText && (
        <View style={styles.translationContainer}>
          <Text style={styles.translatedText}>
            {translation.translatedText}
          </Text>
          <Text style={styles.translationAttribution}>
            Translated from {translation.sourceLanguageName}
          </Text>
        </View>
      )}
      {translation.translationError && (
        <Text style={styles.translationError}>
          Translation failed. Try again.
        </Text>
      )}
      {translation.showTranslateButton && (
        <TouchableOpacity
          style={styles.translateButton}
          onPress={translation.handleTranslate}
          disabled={translation.isTranslating}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            translation.isShowingTranslation
              ? "Show original"
              : `Translate from ${translation.sourceLanguageName}`
          }
        >
          {translation.isTranslating ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
          ) : (
            <TranslateIcon size={14} color={colors.primary} />
          )}
          <Text style={[styles.translateButtonText, { color: colors.primary }]}>
            {translation.isTranslating
              ? "Translating..."
              : translation.isShowingTranslation
                ? "Show original"
                : `Translate from ${translation.sourceLanguageName}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Embeds */}
      <PostEmbed
        embed={postView.embed}
        postUri={postView.uri}
        postAuthorDid={author.did}
        isVisible={isVisible}
        onImagePress={onImagePress}
        onLinkPress={onLinkPress}
        onQuotePress={onQuotePress}
        blurImages={blurImages}
      />

      {/* Engagement Bar */}
      <PostCardActions
        postView={postView}
        colors={colors}
        isOnline={isOnline}
        isLiked={isLiked}
        isBookmarked={isBookmarked}
        likeAnimStyle={likeAnimStyle}
        repostAnimStyle={repostAnimStyle}
        bookmarkAnimStyle={bookmarkAnimStyle}
        onReply={onReply}
        handleRepostPress={handleRepostPress}
        onPressRepostCount={onPressRepostCount}
        handleLikePress={handleLikePress}
        onPressLikeCount={onPressLikeCount}
        handleBookmarkPress={handleBookmarkPress}
        handleBookmarkLongPress={handleBookmarkLongPress}
        handleShare={handleShare}
      />
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    content: {
      padding: 16,
    },
    replyContext: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 4,
      paddingVertical: 6,
      marginBottom: 2,
    },
    replyContextBar: {
      width: 2,
      alignSelf: "stretch",
      borderRadius: 1,
      backgroundColor: colors.info || colors.primary,
    },
    replyContextBody: {
      flex: 1,
      gap: 2,
    },
    replyContextHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    replyContextText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    replyContextHandle: {
      fontWeight: "600",
      color: colors.info || colors.primary,
    },
    replyContextPreview: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    authorSection: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    authorInfo: {
      flex: 1,
      marginLeft: 12,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    moreButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    displayName: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
      marginBottom: 2,
    },
    handle: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
    },
    timestamp: {
      color: colors.textTertiary,
      fontSize: fontSize.footnote,
      marginRight: 4,
    },
    editedBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 3,
    },
    editedText: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    originalTextContainer: {
      borderLeftWidth: 2,
      borderLeftColor: colors.textTertiary,
      paddingLeft: 12,
      marginBottom: 12,
      marginTop: 4,
    },
    originalTextContent: {
      color: colors.textSecondary,
      fontSize: fontSize.footnote,
      lineHeight: 18,
    },
    originalTextLabel: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      marginTop: 4,
    },
    text: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
      marginBottom: 12,
    },
    translationContainer: {
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
      paddingLeft: 12,
      marginBottom: 12,
      marginTop: 4,
    },
    translatedText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
    },
    translationAttribution: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      marginTop: 4,
    },
    translationError: {
      color: colors.danger,
      fontSize: fontSize.caption1,
      marginTop: 2,
      marginBottom: 4,
    },
    translateButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      marginBottom: 8,
    },
    translateButtonText: {
      fontSize: fontSize.footnote,
      fontWeight: "500",
    },
  });
}
