import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import {AppBskyFeedDefs, AppBskyFeedPost, AppBskyEmbedImages} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {ReplyIcon, RepostIcon, HeartIcon, BookmarkIcon} from './icons';
import {RichText} from '../utils/rich-text';
import {useNetwork} from '../contexts/NetworkContext';

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
}: PostCardProps) {
  const { isOnline } = useNetwork();
  const postView = post.post;
  const author = postView.author;

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

        {/* Embed Images */}
        {AppBskyEmbedImages.isView(postView.embed) && (
          <View style={styles.images}>
            {postView.embed.images.map((img, idx) => (
              <Image
                key={idx}
                source={{uri: img.thumb}}
                style={styles.image}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

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
            onPress={onRepost}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <RepostIcon size={18} color={isOnline ? "#9ca3af" : "#4b5563"} />
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.repostCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={onLike}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <HeartIcon size={18} color={isOnline ? (isLiked ? '#ef4444' : '#9ca3af') : '#4b5563'} filled={isLiked} />
            <Text style={[styles.engagementCount, !isOnline && styles.disabled]}>
              {postView.likeCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={onBookmark}
            activeOpacity={0.7}
            disabled={!isOnline}>
            <BookmarkIcon size={18} color={isOnline ? (isBookmarked ? '#3b82f6' : '#9ca3af') : '#4b5563'} filled={isBookmarked} />
          </TouchableOpacity>
        </View>
      </View>
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
  },
  text: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 4,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#1f2937',
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
});
