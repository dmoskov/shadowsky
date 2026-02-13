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
  onReport,
  currentUserDid,
}: PostCardProps) {
  const { isOnline } = useNetwork();
  const postView = post.post;
  const author = postView.author;
  const [showMenu, setShowMenu] = useState(false);
  const blockMutation = useBlockUser();
  const muteMutation = useMuteUser();

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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}>
      <View style={styles.content}>
        {/* Author Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.authorSection}
            onPress={handleProfilePress}
            activeOpacity={0.7}>
            <Avatar uri={author.avatar} size={44} />
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
                activeOpacity={0.7}>
                <MoreIcon size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Post Text */}
        {record && (
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
        />

        {/* Engagement Bar */}
        <View style={styles.engagementBar}>
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={onReply}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <ReplyIcon size={18} color={isOnline ? "#9ca3af" : "#4b5563"} />
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.replyCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={() => {
              triggerHaptic('medium');
              onRepost?.();
            }}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <RepostIcon size={18} color={isOnline ? "#9ca3af" : "#4b5563"} />
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.repostCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={() => {
              triggerHaptic('light');
              onLike?.();
            }}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <HeartIcon size={18} color={isOnline ? (isLiked ? '#ef4444' : '#9ca3af') : '#4b5563'} filled={isLiked} />
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.likeCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={() => {
              triggerHaptic('light');
              onBookmark?.();
            }}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <BookmarkIcon size={18} color={isOnline ? (isBookmarked ? colors.primary : '#9ca3af') : '#4b5563'} filled={isBookmarked} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
            activeOpacity={0.7}>
            <SendIcon size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

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
            <TouchableOpacity style={styles.menuItem} onPress={handleMuteUser}>
              <Text style={styles.menuItemText}>Mute @{author.handle}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Block @{author.handle}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Report Post
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => setShowMenu(false)}>
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
