import React, {useState, useCallback, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Modal, Alert} from 'react-native';
import {AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {ReplyIcon, RepostIcon, HeartIcon, BookmarkIcon, MoreIcon, SendIcon} from './icons';
import {RichText} from '../utils/rich-text';
import {useNetwork} from '../contexts/NetworkContext';
import {sharePost} from '../utils/share';
import {PostEmbed} from './PostEmbed';
import {useBlockUser, useMuteUser} from '../hooks/api/useProfile';
import {colors} from '../constants/theme';
import {triggerHaptic} from '../utils/haptics';
import {useModeration} from '../contexts/ModerationContext';
import {ContentLabelWarning} from './ContentLabelWarning';
import {ReportModal} from './ReportModal';

interface PostCardProps {
  post: AppBskyFeedDefs.FeedViewPost;
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
}

function PostCardComponent({
  post,
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
  onBlock,
  onMute,
  onPressLikeCount,
  onPressRepostCount,
  onPressQuoteCount,
  onReport,
  currentUserDid,
}: PostCardProps) {
  const { isOnline } = useNetwork();
  const postView = post.post;
  const author = postView.author;
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const blockMutation = useBlockUser();
  const muteMutation = useMuteUser();
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

  // Memoized event handlers
  const handleProfilePress = useCallback(() => {
    if (onPressProfile) {
      onPressProfile(author.handle);
    }
  }, [onPressProfile, author.handle]);

  const handleMuteUser = useCallback(() => {
    setShowMenu(false);
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
              Alert.alert('Success', `@${author.handle} has been muted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to mute user. Please try again.');
            }
          },
        },
      ]
    );
  }, [author.handle, author.did, muteMutation]);

  const handleBlockUser = useCallback(() => {
    setShowMenu(false);
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
              Alert.alert('Success', `@${author.handle} has been blocked.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  }, [author.handle, author.did, blockMutation]);

  const handleReport = useCallback(() => {
    setShowMenu(false);
    setShowReportModal(true);
  }, []);

  const handleBlockAfterReport = useCallback(async (did: string) => {
    try {
      await blockMutation.mutateAsync(did);
      Alert.alert('Success', `@${author.handle} has been blocked.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  }, [blockMutation, author.handle]);

  const handleMuteAfterReport = useCallback(async (did: string) => {
    try {
      await muteMutation.mutateAsync(did);
      Alert.alert('Success', `@${author.handle} has been muted.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to mute user. Please try again.');
    }
  }, [muteMutation, author.handle]);

  const handleShare = useCallback(() => {
    sharePost(post);
  }, [post]);

  const handleMenuOpen = useCallback(() => {
    setShowMenu(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setShowMenu(false);
  }, []);

  const handleLikePress = useCallback(() => {
    triggerHaptic('light');
    onLike?.();
  }, [onLike]);

  const handleRepostPress = useCallback(() => {
    triggerHaptic('medium');
    onRepost?.();
  }, [onRepost]);

  const handleBookmarkPress = useCallback(() => {
    triggerHaptic('light');
    onBookmark?.();
  }, [onBookmark]);

  // Memoized computed values
  const timestamp = useMemo(
    () => formatDistanceToNow(new Date(postView.indexedAt), { addSuffix: true }),
    [postView.indexedAt]
  );

  const isLiked = useMemo(() => !!postView.viewer?.like, [postView.viewer?.like]);

  const isOwnPost = useMemo(() => currentUserDid === author.did, [currentUserDid, author.did]);

  const postText = useMemo(
    () => (record && typeof record.text === 'string' ? record.text : ''),
    [record]
  );

  const postPreview = useMemo(
    () => (postText ? `${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}` : 'No text content'),
    [postText]
  );

  const accessibilityLabel = useMemo(
    () => `Post by ${author.displayName || author.handle}. ${postPreview}. ${postView.likeCount || 0} likes, ${postView.repostCount || 0} reposts, ${postView.replyCount || 0} replies. Posted ${timestamp}`,
    [author.displayName, author.handle, postPreview, postView.likeCount, postView.repostCount, postView.replyCount, timestamp]
  );

  // Memoized content label checks
  const labels = useMemo(() => postView.labels || [], [postView.labels]);
  const hideContent = useMemo(() => shouldHideContent(labels), [shouldHideContent, labels]);
  const warnContent = useMemo(() => shouldWarnContent(labels), [shouldWarnContent, labels]);
  const blurImages = useMemo(() => shouldBlurImages(labels), [shouldBlurImages, labels]);

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
            {!isOwnPost && isOnline && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={handleMenuOpen}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityHint="Double tap to open menu with mute, block, and report options">
                <MoreIcon size={20} color=colors.textSecondary />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Post Text */}
        {record && typeof record.text === 'string' && (
          <RichText
            text={record.text}
            facets={record.facets}
            onMentionPress={onMentionPress}
            onHashtagPress={onHashtagPress}
            style={styles.text}
          />
        )}

        {/* Embeds (Images, Links, Quotes, Videos) */}
        <PostEmbed
          embed={postView.embed}
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
              <RepostIcon size={18} color={isOnline ? colors.textSecondary : colors.borderLight} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPressRepostCount}
              disabled={!onPressRepostCount || (postView.repostCount || 0) === 0}
              activeOpacity={0.7}>
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
              <HeartIcon size={18} color={isOnline ? (isLiked ? colors.danger : colors.textSecondary) : colors.borderLight} filled={isLiked} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPressLikeCount}
              disabled={!onPressLikeCount || (postView.likeCount || 0) === 0}
              activeOpacity={0.7}>
              <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
                {postView.likeCount || 0}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleBookmarkPress}
            activeOpacity={0.7}
            disabled={!isOnline}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
            accessibilityHint={`Double tap to ${isBookmarked ? 'remove' : 'add'} bookmark`}
            accessibilityState={{disabled: !isOnline, selected: isBookmarked}}>
            <BookmarkIcon size={18} color={isOnline ? (isBookmarked ? colors.primary : colors.textSecondary) : colors.borderLight} filled={isBookmarked} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            accessibilityHint="Double tap to share this post">
            <SendIcon size={18} color=colors.textSecondary />
          </TouchableOpacity>
        </View>
      </View>
  ), [
    author,
    timestamp,
    isOwnPost,
    isOnline,
    handleProfilePress,
    handleMenuOpen,
    record,
    onMentionPress,
    onHashtagPress,
    postView.embed,
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
    isBookmarked,
    handleShare,
  ]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to view full post">
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

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={handleMenuClose}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleMenuClose}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMuteUser}
              accessibilityRole="button"
              accessibilityLabel={`Mute @${author.handle}`}
              accessibilityHint="Double tap to mute this user">
              <Text style={styles.menuItemText}>Mute @{author.handle}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBlockUser}
              accessibilityRole="button"
              accessibilityLabel={`Block @${author.handle}`}
              accessibilityHint="Double tap to block this user">
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Block @{author.handle}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReport}
              accessibilityRole="button"
              accessibilityLabel="Report post"
              accessibilityHint="Double tap to report this post">
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Report Post
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={handleMenuClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
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
    </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
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
    padding: 4,
  },
  displayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  timestamp: {
    color: colors.textTertiary,
    fontSize: 13,
    marginRight: 4,
  },
  text: {
    color: colors.text,
    fontSize: 15,
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
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  iconButton: {
    padding: 0,
  },
  engagementCount: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  disabled: {
    color: colors.borderLight,
    opacity: 0.5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  menuContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuItemDanger: {
    color: colors.danger,
  },
});
