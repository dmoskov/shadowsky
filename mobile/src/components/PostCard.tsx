import React, {useState, useCallback, useMemo, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ActionSheetIOS, Platform, NativeSyntheticEvent} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import ContextMenu, {ContextMenuOnPressNativeEvent} from 'react-native-context-menu-view';
import {AppBskyFeedDefs, AppBskyFeedPost, AppBskyRichtextFacet} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from '../i18n/format-date';
import {ReplyIcon, RepostIcon, HeartIcon, BookmarkIcon, MoreIcon, SendIcon, TranslateIcon} from './icons';
import {RichText} from '../utils/rich-text';
import {useNetwork} from '../contexts/NetworkContext';
import {sharePost} from '../utils/share';
import {PostEmbed} from './PostEmbed';
import {InlineErrorBoundary} from './ui/InlineErrorBoundary';
import {useBlockUser, useMuteUser} from '../hooks/api/useProfile';
import {useDeletePost} from '../hooks/api/usePosts';
import {recordBlock, recordMute} from '../services/moderation-history';
import {useTheme} from '../contexts/ThemeContext';
import {triggerHaptic} from '../utils/haptics';
import {useModeration} from '../contexts/ModerationContext';
import {ContentLabelWarning} from './ContentLabelWarning';
import {ReportModal} from './ReportModal';
import {SaveToCollectionModal} from './SaveToCollectionModal';
import {usePostTranslation} from '../hooks/usePostTranslation';
import {useSharedTransition} from '../contexts/SharedTransitionContext';
import {useToast} from '../contexts/ToastContext';
import {fontSize} from '../utils/typography';

interface PostCardProps {
  post: AppBskyFeedDefs.FeedViewPost;
  isVisible?: boolean;
  onPress?: () => void;
  onPressProfile?: (handle: string) => void;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  onBlock?: (did: string) => void;
  onMute?: (did: string) => void;
  onReport?: (uri: string, cid: string) => void;
  currentUserDid?: string;
  onPressLikeCount?: () => void;
  onPressRepostCount?: () => void;
  onPressQuoteCount?: () => void;
  onQuotePost?: () => void;
}

function PostCardComponent({
  post,
  isVisible = false,
  onPress,
  onPressProfile,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  isBookmarked = false,
  onMentionPress,
  onHashtagPress,
  onImagePress,
  onLinkPress,
  onQuotePress,
  onBlock: _onBlock,
  onMute: _onMute,
  onPressLikeCount,
  onPressRepostCount,
  onPressQuoteCount: _onPressQuoteCount,
  onReport: _onReport,
  currentUserDid,
  onQuotePost,
}: PostCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isOnline } = useNetwork();
  const { showToast } = useToast();
  const {prepareTransition} = useSharedTransition();
  const cardRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  // Micro-animation shared values for engagement buttons
  const likeScale = useSharedValue(1);
  const repostScale = useSharedValue(1);
  const bookmarkScale = useSharedValue(1);

  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  const repostAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: repostScale.value }],
  }));
  const bookmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bookmarkScale.value }],
  }));

  function triggerBounce(scale: SharedValue<number>) {
    scale.value = withSequence(
      withSpring(0.7, { damping: 20, stiffness: 400, mass: 0.5 }),
      withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 }),
    );
  }

  const postView = post.post;
  const author = postView.author;
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSaveToCollection, setShowSaveToCollection] = useState(false);
  const handleCloseReportModal = useCallback(() => setShowReportModal(false), []);
  const handleCloseSaveToCollection = useCallback(() => setShowSaveToCollection(false), []);
  const blockMutation = useBlockUser();
  const muteMutation = useMuteUser();
  const deleteMutation = useDeletePost();
  const {
    shouldHideContent,
    shouldWarnContent,
    shouldBlurImages,
    getContentWarningText,
  } = useModeration();

  // Memoized type guard for record
  const record = useMemo(
    () => (AppBskyFeedPost.isRecord(postView.record) ? postView.record : undefined),
    [postView.record]
  );

  const isLiked = useMemo(() => !!postView.viewer?.like, [postView.viewer?.like]);
  const isReposted = useMemo(() => !!postView.viewer?.repost, [postView.viewer?.repost]);

  const isOwnPost = useMemo(() => currentUserDid === author.did, [currentUserDid, author.did]);

  const postText = useMemo(
    () => (record && typeof record.text === 'string' ? record.text : ''),
    [record]
  );

  // Memoized event handlers
  const handleProfilePress = useCallback(() => {
    if (onPressProfile) {
      onPressProfile(author.handle);
    }
  }, [onPressProfile, author.handle]);

  const handleMuteUser = useCallback(() => {
    Alert.alert(
      'Mute User',
      `Are you sure you want to mute @${author.handle}? You won't see their posts in your timeline.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute',
          style: 'destructive',
          onPress: async () => {
            try {
              await muteMutation.mutateAsync(author.did);
              recordMute({
                subjectDid: author.did,
                subjectHandle: author.handle,
                subjectDisplayName: author.displayName,
              });
              showToast("User muted", { type: "success" });
            } catch (error) {
              Alert.alert('Error', 'Failed to mute user. Please try again.');
            }
          },
        },
      ]
    );
  }, [author.handle, author.did, author.displayName, muteMutation, showToast]);

  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${author.handle}? They won't be able to follow you or view your posts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockMutation.mutateAsync(author.did);
              recordBlock({
                id: `block_${author.did}_${Date.now()}`,
                subjectDid: author.did,
                subjectHandle: author.handle,
                subjectDisplayName: author.displayName,
              });
              showToast("User blocked", { type: "success" });
            } catch (error) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  }, [author.handle, author.did, author.displayName, blockMutation, showToast]);

  const handleReport = useCallback(() => {
    setShowReportModal(true);
  }, []);

  const handleDeletePost = useCallback(() => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(postView.uri);
              showToast("Post deleted", { type: "success" });
            } catch {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  }, [postView.uri, deleteMutation, showToast]);

  const handleBlockAfterReport = useCallback(async (did: string) => {
    try {
      await blockMutation.mutateAsync(did);
      recordBlock({
        id: `block_${did}_${Date.now()}`,
        subjectDid: did,
        subjectHandle: author.handle,
        subjectDisplayName: author.displayName,
      });
      showToast("User blocked", { type: "success" });
    } catch (error) {
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  }, [blockMutation, author.handle, author.displayName, showToast]);

  const handleMuteAfterReport = useCallback(async (did: string) => {
    try {
      await muteMutation.mutateAsync(did);
      recordMute({
        subjectDid: did,
        subjectHandle: author.handle,
        subjectDisplayName: author.displayName,
      });
      showToast("User muted", { type: "success" });
    } catch (error) {
      Alert.alert('Error', 'Failed to mute user. Please try again.');
    }
  }, [muteMutation, author.handle, author.displayName, showToast]);

  const handleShare = useCallback(() => {
    sharePost(post);
  }, [post]);

  const handleMorePress = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    triggerHaptic('light');

    const options: string[] = ['Cancel'];
    const handlers: Array<() => void> = [];
    const destructiveIndices: number[] = [];

    if (postText) {
      options.push('Copy Text');
      handlers.push(handleCopyText);
    }

    options.push('Reply');
    handlers.push(() => onReply?.());

    options.push(isReposted ? 'Undo Repost' : 'Repost');
    handlers.push(handleRepostPress);

    if (onQuotePost) {
      options.push('Quote Post');
      handlers.push(onQuotePost);
    }

    options.push(isLiked ? 'Unlike' : 'Like');
    handlers.push(handleLikePress);

    options.push(isBookmarked ? 'Remove Bookmark' : 'Bookmark');
    handlers.push(handleBookmarkPress);

    options.push('Share');
    handlers.push(handleShare);

    if (showTranslateButton) {
      options.push(isShowingTranslation ? 'Show Original' : 'Translate');
      handlers.push(handleTranslate);
    }

    if (isOwnPost) {
      options.push('Delete Post');
      destructiveIndices.push(options.length - 1);
      handlers.push(handleDeletePost);
    } else {
      options.push(`Mute @${author.handle}`);
      handlers.push(handleMuteUser);

      options.push(`Block @${author.handle}`);
      destructiveIndices.push(options.length - 1);
      handlers.push(handleBlockUser);

      options.push('Report Post');
      destructiveIndices.push(options.length - 1);
      handlers.push(handleReport);
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: destructiveIndices,
      },
      (buttonIndex) => {
        if (buttonIndex > 0 && buttonIndex <= handlers.length) {
          handlers[buttonIndex - 1]();
        }
      },
    );
  }, [isOwnPost, isReposted, isLiked, isBookmarked, postText, showTranslateButton, isShowingTranslation, author.handle, handleDeletePost, handleMuteUser, handleBlockUser, handleReport, handleCopyText, onReply, handleRepostPress, onQuotePost, handleLikePress, handleBookmarkPress, handleShare, handleTranslate]);

  const handleLikePress = useCallback(() => {
    triggerHaptic('light');
    triggerBounce(likeScale);
    onLike?.();
  }, [onLike]);

  const handleRepostPress = useCallback(() => {
    triggerHaptic('medium');
    triggerBounce(repostScale);
    onRepost?.();
  }, [onRepost]);

  const handleBookmarkPress = useCallback(() => {
    triggerHaptic('light');
    triggerBounce(bookmarkScale);
    onBookmark?.();
  }, [onBookmark]);

  const handleBookmarkLongPress = useCallback(() => {
    triggerHaptic('medium');
    // First ensure the post is bookmarked
    if (!isBookmarked && onBookmark) {
      onBookmark();
    }
    setShowSaveToCollection(true);
  }, [isBookmarked, onBookmark]);

  const handleCopyText = useCallback(() => {
    if (postText) {
      Clipboard.setStringAsync(postText);
      showToast('Text copied', { type: 'success' });
    }
  }, [postText, showToast]);

  // Native context menu actions for long-press
  const contextMenuActions = useMemo(() => {
    const actions: Array<{title: string; systemIcon?: string; destructive?: boolean}> = [];

    if (postText) {
      actions.push({ title: 'Copy Text', systemIcon: 'doc.on.doc' });
    }

    actions.push(
      { title: 'Reply', systemIcon: 'arrowshape.turn.up.left' },
      { title: isReposted ? 'Undo Repost' : 'Repost', systemIcon: 'arrow.2.squarepath' },
    );

    if (onQuotePost) {
      actions.push({ title: 'Quote Post', systemIcon: 'quote.bubble' });
    }

    actions.push(
      { title: isLiked ? 'Unlike' : 'Like', systemIcon: isLiked ? 'heart.slash' : 'heart' },
      { title: isBookmarked ? 'Remove Bookmark' : 'Bookmark', systemIcon: isBookmarked ? 'bookmark.slash' : 'bookmark' },
      { title: 'Share', systemIcon: 'square.and.arrow.up' },
    );

    if (showTranslateButton) {
      actions.push({
        title: isShowingTranslation ? 'Show Original' : 'Translate',
        systemIcon: 'character.book.closed',
      });
    }

    if (isOwnPost) {
      actions.push({ title: 'Delete Post', systemIcon: 'trash', destructive: true });
    } else {
      actions.push(
        { title: `Mute @${author.handle}`, systemIcon: 'speaker.slash' },
        { title: `Block @${author.handle}`, systemIcon: 'hand.raised', destructive: true },
        { title: 'Report Post', systemIcon: 'exclamationmark.bubble', destructive: true },
      );
    }

    return actions;
  }, [isLiked, isReposted, isBookmarked, isOwnPost, author.handle, postText, onQuotePost, showTranslateButton, isShowingTranslation]);

  const handleContextMenuAction = useCallback((e: NativeSyntheticEvent<ContextMenuOnPressNativeEvent>) => {
    const { name } = e.nativeEvent;

    switch (name) {
      case 'Copy Text':
        handleCopyText();
        break;
      case 'Reply':
        onReply?.();
        break;
      case 'Repost':
      case 'Undo Repost':
        handleRepostPress();
        break;
      case 'Quote Post':
        onQuotePost?.();
        break;
      case 'Like':
      case 'Unlike':
        handleLikePress();
        break;
      case 'Bookmark':
      case 'Remove Bookmark':
        handleBookmarkPress();
        break;
      case 'Share':
        handleShare();
        break;
      case 'Translate':
      case 'Show Original':
        handleTranslate();
        break;
      case 'Delete Post':
        handleDeletePost();
        break;
      case 'Report Post':
        handleReport();
        break;
      default:
        if (name.startsWith('Mute')) handleMuteUser();
        else if (name.startsWith('Block')) handleBlockUser();
        break;
    }
  }, [onReply, handleRepostPress, onQuotePost, handleLikePress, handleBookmarkPress, handleShare, handleTranslate, handleDeletePost, handleMuteUser, handleBlockUser, handleReport, handleCopyText]);

  // Memoized computed values
  const timestamp = useMemo(
    () => formatDistanceToNow(new Date(postView.indexedAt), { addSuffix: true }),
    [postView.indexedAt]
  );

  // Translation support
  const postLangs = useMemo(
    () => (record && Array.isArray(record.langs) ? record.langs as string[] : undefined),
    [record]
  );
  const {
    showTranslateButton,
    isTranslating,
    translatedText,
    isShowingTranslation,
    translationError,
    sourceLanguageName,
    handleTranslate,
  } = usePostTranslation({
    postUri: postView.uri,
    postText,
    postLangs,
  });

  const postPreviewText = useMemo(
    () => (postText ? `${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}` : 'No text content'),
    [postText]
  );

  const accessibilityLabel = useMemo(
    () => `Post by ${author.displayName || author.handle}. ${postPreviewText}. ${postView.likeCount || 0} likes, ${postView.repostCount || 0} reposts, ${postView.replyCount || 0} replies. Posted ${timestamp}`,
    [author.displayName, author.handle, postPreviewText, postView.likeCount, postView.repostCount, postView.replyCount, timestamp]
  );

  // 3D Touch peek preview for native context menu
  const contextMenuPreview = useMemo(() => (
    <View style={styles.previewContainer}>
      <View style={styles.previewHeader}>
        <Avatar uri={author.avatar} size={36} />
        <View style={styles.previewAuthorInfo}>
          <Text style={styles.previewDisplayName} numberOfLines={1}>
            {author.displayName || author.handle}
          </Text>
          <Text style={styles.previewHandle} numberOfLines={1}>
            @{author.handle}
          </Text>
        </View>
      </View>
      {postText ? (
        <Text style={styles.previewText} numberOfLines={12}>
          {postText}
        </Text>
      ) : null}
      <Text style={styles.previewTimestamp}>{timestamp}</Text>
    </View>
  ), [author.avatar, author.displayName, author.handle, postText, timestamp, styles]);

  // Memoized content label checks
  const labels = useMemo(() => postView.labels || [], [postView.labels]);
  const hideContent = useMemo(() => shouldHideContent(labels), [shouldHideContent, labels]);
  const warnContent = useMemo(() => shouldWarnContent(labels), [shouldWarnContent, labels]);
  const blurImages = useMemo(() => shouldBlurImages(labels), [shouldBlurImages, labels]);

  // Extract first image thumbnail for transition preview
  const firstImageThumb = useMemo(() => {
    const embed = postView.embed;
    if (!embed) return undefined;
    if ('images' in embed && Array.isArray(embed.images) && embed.images.length > 0) {
      return (embed.images[0] as any)?.thumb as string | undefined;
    }
    return undefined;
  }, [postView.embed]);

  // Handle press with shared element transition measurement
  const handleCardPress = useCallback(() => {
    if (!onPress) return;
    if (cardRef.current) {
      (cardRef.current as any).measureInWindow?.(
        (x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            prepareTransition(
              {x, y, width, height},
              {
                uri: postView.uri,
                authorAvatar: author.avatar,
                authorName: author.displayName || undefined,
                authorHandle: author.handle,
                text: postText || undefined,
                imageThumb: firstImageThumb,
              },
            );
          }
          onPress();
        },
      );
    } else {
      onPress();
    }
  }, [onPress, prepareTransition, postView.uri, author.avatar, author.displayName, author.handle, postText, firstImageThumb]);

  // Don't render hidden content
  if (hideContent) {
    return null;
  }

  // Memoized post content JSX
  const postContent = useMemo(() => (
      <View style={styles.content}>
        {/* Author Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.authorSection}
            onPress={handleProfilePress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`View profile of ${author.displayName || author.handle}`}
            accessibilityHint="Double tap to open profile">
            <Avatar uri={author.avatar} size={44} accessibilityLabel={`${author.displayName || author.handle}'s avatar`} />
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
            {isOnline && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={handleMorePress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityHint={isOwnPost ? "Double tap to open menu with delete option" : "Double tap to open menu with mute, block, and report options"}>
                <MoreIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Post Text */}
        {record && typeof record.text === 'string' && (
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

        {/* Inline Translation */}
        {isShowingTranslation && translatedText && (
          <View style={styles.translationContainer}>
            <Text style={styles.translatedText}>{translatedText}</Text>
            <Text style={styles.translationAttribution}>
              Translated from {sourceLanguageName}
            </Text>
          </View>
        )}
        {translationError && (
          <Text style={styles.translationError}>Translation failed. Try again.</Text>
        )}
        {showTranslateButton && (
          <TouchableOpacity
            style={styles.translateButton}
            onPress={handleTranslate}
            disabled={isTranslating}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              isShowingTranslation
                ? 'Show original'
                : `Translate from ${sourceLanguageName}`
            }>
            {isTranslating ? (
              <ActivityIndicator size="small" color={colors.primary} style={{marginRight: 4}} />
            ) : (
              <TranslateIcon size={14} color={colors.primary} />
            )}
            <Text style={[styles.translateButtonText, {color: colors.primary}]}>
              {isTranslating
                ? 'Translating...'
                : isShowingTranslation
                  ? 'Show original'
                  : `Translate from ${sourceLanguageName}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Embeds (Images, Links, Quotes, Videos) */}
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
        <View style={styles.engagementBar}>
          <View style={styles.engagementButton}>
            <TouchableOpacity
              onPress={onReply}
              activeOpacity={0.7}
              disabled={!isOnline}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`Reply. ${postView.replyCount || 0} replies`}
              accessibilityHint="Double tap to reply to this post"
              accessibilityState={{disabled: !isOnline}}>
              <ReplyIcon size={18} color={isOnline ? colors.textSecondary : colors.borderLight} />
            </TouchableOpacity>
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.replyCount || 0}
            </Text>
          </View>

          <View style={styles.engagementButton}>
            <TouchableOpacity
              onPress={handleRepostPress}
              activeOpacity={0.7}
              disabled={!isOnline}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`Repost. ${postView.repostCount || 0} reposts`}
              accessibilityHint="Double tap to repost this post"
              accessibilityState={{disabled: !isOnline}}>
              <Animated.View style={repostAnimStyle}>
                <RepostIcon size={18} color={isOnline ? colors.textSecondary : colors.borderLight} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPressRepostCount}
              disabled={!onPressRepostCount || (postView.repostCount || 0) === 0}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${postView.repostCount || 0} reposts`}
              accessibilityHint="Double tap to view who reposted">
              <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
                {postView.repostCount || 0}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.engagementButton}>
            <TouchableOpacity
              onPress={handleLikePress}
              activeOpacity={0.7}
              disabled={!isOnline}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}. ${postView.likeCount || 0} likes`}
              accessibilityHint={`Double tap to ${isLiked ? 'remove like from' : 'like'} this post`}
              accessibilityState={{disabled: !isOnline, selected: isLiked}}>
              <Animated.View style={likeAnimStyle}>
                <HeartIcon size={18} color={isOnline ? (isLiked ? colors.danger : colors.textSecondary) : colors.borderLight} filled={isLiked} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPressLikeCount}
              disabled={!onPressLikeCount || (postView.likeCount || 0) === 0}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${postView.likeCount || 0} likes`}
              accessibilityHint="Double tap to view who liked">
              <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
                {postView.likeCount || 0}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleBookmarkPress}
            onLongPress={handleBookmarkLongPress}
            delayLongPress={400}
            activeOpacity={0.7}
            disabled={!isOnline}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
            accessibilityHint={`Double tap to ${isBookmarked ? 'remove' : 'add'} bookmark. Long press to save to collection.`}
            accessibilityState={{disabled: !isOnline, selected: isBookmarked}}>
            <Animated.View style={bookmarkAnimStyle}>
              <BookmarkIcon size={18} color={isOnline ? (isBookmarked ? colors.primary : colors.textSecondary) : colors.borderLight} filled={isBookmarked} />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            accessibilityHint="Double tap to share this post">
            <SendIcon size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
  ), [
    author,
    timestamp,
    isOwnPost,
    isOnline,
    handleProfilePress,
    handleMorePress,
    record,
    onMentionPress,
    onHashtagPress,
    postView.embed,
    postView.uri,
    isVisible,
    onImagePress,
    onLinkPress,
    onQuotePress,
    blurImages,
    postView.replyCount,
    onReply,
    handleRepostPress,
    postView.repostCount,
    onPressRepostCount,
    handleLikePress,
    isLiked,
    postView.likeCount,
    onPressLikeCount,
    handleBookmarkPress,
    handleBookmarkLongPress,
    isBookmarked,
    handleShare,
    colors,
    likeAnimStyle,
    repostAnimStyle,
    bookmarkAnimStyle,
  ]);

  return (
    <ContextMenu
      actions={contextMenuActions}
      onPress={handleContextMenuAction}
      onPreviewPress={handleCardPress}
      preview={contextMenuPreview}
      previewBackgroundColor={colors.cardBackground}>
      <TouchableOpacity
        ref={cardRef}
        style={styles.container}
        onPress={handleCardPress}
        activeOpacity={0.9}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Double tap to view full post. Long press for more options">
        {warnContent ? (
          <ContentLabelWarning
            labels={labels}
            warningText={getContentWarningText(labels)}
            blurImages={blurImages}>
            {postContent}
          </ContentLabelWarning>
        ) : (
          postContent
        )}

        {/* Report Modal */}
        <ReportModal
          visible={showReportModal}
          onClose={handleCloseReportModal}
          reportType="post"
          subjectUri={postView.uri}
          subjectCid={postView.cid}
          subjectDid={author.did}
          subjectHandle={author.handle}
          subjectDisplayName={author.displayName}
          subjectText={postText}
          onBlock={handleBlockAfterReport}
          onMute={handleMuteAfterReport}
        />

        {/* Save to Collection Modal */}
        <SaveToCollectionModal
          visible={showSaveToCollection}
          postUri={postView.uri}
          onClose={handleCloseSaveToCollection}
        />
      </TouchableOpacity>
    </ContextMenu>
  );
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: PostCardProps, nextProps: PostCardProps): boolean {
  // Compare post URI (unique identifier)
  if (prevProps.post.post.uri !== nextProps.post.post.uri) {
    return false;
  }

  // Compare post content changes (likes, reposts, etc.)
  if (
    prevProps.post.post.likeCount !== nextProps.post.post.likeCount ||
    prevProps.post.post.repostCount !== nextProps.post.post.repostCount ||
    prevProps.post.post.replyCount !== nextProps.post.post.replyCount ||
    prevProps.post.post.viewer?.like !== nextProps.post.post.viewer?.like ||
    prevProps.post.post.viewer?.repost !== nextProps.post.post.viewer?.repost
  ) {
    return false;
  }

  // Compare visibility (for video autoplay)
  if (prevProps.isVisible !== nextProps.isVisible) {
    return false;
  }

  // Compare bookmark state
  if (prevProps.isBookmarked !== nextProps.isBookmarked) {
    return false;
  }

  // Compare current user DID
  if (prevProps.currentUserDid !== nextProps.currentUserDid) {
    return false;
  }

  // Compare labels (content moderation)
  const prevLabels = prevProps.post.post.labels || [];
  const nextLabels = nextProps.post.post.labels || [];
  if (prevLabels.length !== nextLabels.length) {
    return false;
  }

  // All other props are assumed stable (handlers, callbacks)
  // We don't need to compare function references as they should be memoized by parent
  return true;
}

// Export memoized component
export const PostCard = React.memo(PostCardComponent, arePropsEqual);

function createStyles(colors: any) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: '600',
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
  text: {
    color: colors.text,
    fontSize: fontSize.subheadline,
    lineHeight: 20,
    marginBottom: 12,
  },
  engagementBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    // Add subtle background for tap target
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  engagementCount: {
    color: colors.textSecondary,
    fontSize: fontSize.footnote,
  },
  disabled: {
    color: colors.borderLight,
    opacity: 0.5,
  },
  previewContainer: {
    padding: 16,
    minWidth: 280,
    maxWidth: 340,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewAuthorInfo: {
    marginLeft: 10,
    flex: 1,
  },
  previewDisplayName: {
    color: colors.text,
    fontWeight: '600',
    fontSize: fontSize.callout,
    marginBottom: 1,
  },
  previewHandle: {
    color: colors.textSecondary,
    fontSize: fontSize.footnote,
  },
  previewText: {
    color: colors.text,
    fontSize: fontSize.subheadline,
    lineHeight: 20,
  },
  previewTimestamp: {
    color: colors.textTertiary,
    fontSize: fontSize.caption1,
    marginTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    marginBottom: 8,
  },
  translateButtonText: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
  },
  });
}
