import React, {useState} from 'react';
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

export function PostCard({
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
  const blockMutation = useBlockUser();
  const muteMutation = useMuteUser();
  const {
    shouldHideContent,
    shouldWarnContent,
    shouldBlurImages,
    getContentWarningText,
  } = useModeration();

  // Type guard for record
  const record = AppBskyFeedPost.isRecord(postView.record)
    ? postView.record
    : undefined;

  const handleProfilePress = () => {
    if (onPressProfile) {
      onPressProfile(author.handle);
    }
  };

  const handleMuteUser = () => {
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
  };

  const handleBlockUser = () => {
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
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert(
      'Report',
      'Reporting functionality will be available soon.',
      [{ text: 'OK' }]
    );
  };

  // Format timestamp
  const timestamp = formatDistanceToNow(new Date(postView.indexedAt), {
    addSuffix: true,
  });

  const isLiked = !!postView.viewer?.like;
  const isOwnPost = currentUserDid === author.did;

  const handleShare = () => {
    sharePost(post);
  };

  const postText = (record && typeof record.text === 'string') ? record.text : '';
  const postPreview = postText ? `${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}` : 'No text content';
  const accessibilityLabel = `Post by ${author.displayName || author.handle}. ${postPreview}. ${postView.likeCount || 0} likes, ${postView.repostCount || 0} reposts, ${postView.replyCount || 0} replies. Posted ${timestamp}`;

  // Check for content labels
  const labels = postView.labels || [];
  const hideContent = shouldHideContent(labels);
  const warnContent = shouldWarnContent(labels);
  const blurImages = shouldBlurImages(labels);

  // Don't render hidden content
  if (hideContent) {
    return null;
  }

  // Render post content
  const postContent = (
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
                onPress={() => setShowMenu(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityHint="Double tap to open menu with mute, block, and report options">
                <MoreIcon size={20} color="#9ca3af" />
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
              <ReplyIcon size={18} color={isOnline ? "#9ca3af" : "#4b5563"} />
            </TouchableOpacity>
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.replyCount || 0}
            </Text>
          </View>

          <View style={styles.engagementButton}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                onRepost?.();
              }}
              activeOpacity={0.7}
              disabled={!isOnline}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`Repost. ${postView.repostCount || 0} reposts`}
              accessibilityHint="Double tap to repost this post"
              accessibilityState={{disabled: !isOnline}}>
              <RepostIcon size={18} color={isOnline ? "#9ca3af" : "#4b5563"} />
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
              onPress={() => {
                triggerHaptic('light');
                onLike?.();
              }}
              activeOpacity={0.7}
              disabled={!isOnline}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}. ${postView.likeCount || 0} likes`}
              accessibilityHint={`Double tap to ${isLiked ? 'remove like from' : 'like'} this post`}
              accessibilityState={{disabled: !isOnline, selected: isLiked}}>
              <HeartIcon size={18} color={isOnline ? (isLiked ? '#ef4444' : '#9ca3af') : '#4b5563'} filled={isLiked} />
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
            onPress={() => {
              triggerHaptic('light');
              onBookmark?.();
            }}
            activeOpacity={0.7}
            disabled={!isOnline}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
            accessibilityHint={`Double tap to ${isBookmarked ? 'remove' : 'add'} bookmark`}
            accessibilityState={{disabled: !isOnline, selected: isBookmarked}}>
            <BookmarkIcon size={18} color={isOnline ? (isBookmarked ? colors.primary : '#9ca3af') : '#4b5563'} filled={isBookmarked} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            accessibilityHint="Double tap to share this post">
            <SendIcon size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>
  );

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
        onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}>
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
              onPress={() => setShowMenu(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  handle: {
    color: '#9ca3af',
    fontSize: 14,
  },
  timestamp: {
    color: '#6b7280',
    fontSize: 13,
    marginRight: 4,
  },
  text: {
    color: '#ffffff',
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
    color: '#9ca3af',
    fontSize: 13,
  },
  disabled: {
    color: '#4b5563',
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
    backgroundColor: '#1f2937',
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuItemDanger: {
    color: '#ef4444',
  },
});
