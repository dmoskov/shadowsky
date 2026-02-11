import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import {AppBskyFeedDefs, AppBskyFeedPost, AppBskyEmbedImages} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';

interface PostCardProps {
  post: AppBskyFeedDefs.FeedViewPost;
  onPress?: () => void;
  onPressProfile?: (handle: string) => void;
  onLike?: () => void;
  onRepost?: () => void;
  onReply?: () => void;
}

export function PostCard({
  post,
  onPress,
  onPressProfile,
  onLike,
  onRepost,
  onReply,
}: PostCardProps) {
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
        {record && <Text style={styles.text}>{record.text}</Text>}

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
            activeOpacity={0.7}>
            <Text style={styles.engagementIcon}>💬</Text>
            <Text style={styles.engagementCount}>
              {postView.replyCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={onRepost}
            activeOpacity={0.7}>
            <Text style={styles.engagementIcon}>🔄</Text>
            <Text style={styles.engagementCount}>
              {postView.repostCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            onPress={onLike}
            activeOpacity={0.7}>
            <Text style={[styles.engagementIcon, postView.viewer?.like && styles.liked]}>
              {postView.viewer?.like ? '❤️' : '🤍'}
            </Text>
            <Text style={styles.engagementCount}>
              {postView.likeCount || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagementButton}
            activeOpacity={0.7}>
            <Text style={styles.engagementIcon}>📤</Text>
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
  engagementIcon: {
    fontSize: 18,
  },
  liked: {
    opacity: 1,
  },
  engagementCount: {
    color: '#9ca3af',
    fontSize: 13,
  },
});
