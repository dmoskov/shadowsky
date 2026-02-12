import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Modal, Alert} from 'react-native';
import {AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {ReplyIcon, RepostIcon, HeartIcon, BookmarkIcon, MoreVerticalIcon} from './icons';
import {RichText} from '../utils/rich-text';
import {useNetwork} from '../contexts/NetworkContext';
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

  // Format timestamp
  const timestamp = formatDistanceToNow(new Date(postView.indexedAt), {
    addSuffix: true,
  });

  const isLiked = !!postView.viewer?.like;

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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}>
      <View style={styles.content}>
        {/* Author Header */}
        <TouchableOpacity
          style={styles.header}
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
          <Text style={styles.timestamp}>{timestamp}</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}>
            <MoreVerticalIcon size={18} color="#9ca3af" />
          </TouchableOpacity>
        </TouchableOpacity>

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
        </View>
      </View>

      {/* Action Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMuteUser}
              activeOpacity={0.7}>
              <Text style={styles.menuItemText}>Mute @{author.handle}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBlockUser}
              activeOpacity={0.7}>
              <Text style={[styles.menuItemText, styles.dangerText]}>
                Block @{author.handle}
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReport}
              activeOpacity={0.7}>
              <Text style={[styles.menuItemText, styles.dangerText]}>Report</Text>
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
    marginBottom: 12,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
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
  menuButton: {
    padding: 4,
    marginLeft: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#374151',
  },
  dangerText: {
    color: '#ef4444',
  },
});
