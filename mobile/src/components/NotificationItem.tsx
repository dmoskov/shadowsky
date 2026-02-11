import React, {ReactNode} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {AppBskyNotificationListNotifications, AppBskyFeedPost} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {HeartIcon, RepostIcon, FollowIcon, AtSignIcon, ReplyIcon, QuoteIcon, BellIcon} from './icons';

interface NotificationItemProps {
  notification: AppBskyNotificationListNotifications.Notification;
  onPress?: () => void;
  onProfilePress?: (handle: string) => void;
}

export function NotificationItem({
  notification,
  onPress,
  onProfilePress,
}: NotificationItemProps) {
  const author = notification.author;

  // Format timestamp
  const timestamp = formatDistanceToNow(new Date(notification.indexedAt), {
    addSuffix: true,
  });

  // Get notification icon and message based on reason
  const getNotificationContent = (): {icon: ReactNode; message: string; color: string} => {
    switch (notification.reason) {
      case 'like':
        return {
          icon: <HeartIcon size={16} color="#ef4444" filled />,
          message: 'liked your post',
          color: '#ef4444',
        };
      case 'repost':
        return {
          icon: <RepostIcon size={16} color="#10b981" />,
          message: 'reposted your post',
          color: '#10b981',
        };
      case 'follow':
        return {
          icon: <FollowIcon size={16} color="#3b82f6" />,
          message: 'followed you',
          color: '#3b82f6',
        };
      case 'mention':
        return {
          icon: <AtSignIcon size={16} color="#8b5cf6" />,
          message: 'mentioned you',
          color: '#8b5cf6',
        };
      case 'reply':
        return {
          icon: <ReplyIcon size={16} color="#6366f1" />,
          message: 'replied to your post',
          color: '#6366f1',
        };
      case 'quote':
        return {
          icon: <QuoteIcon size={16} color="#06b6d4" />,
          message: 'quoted your post',
          color: '#06b6d4',
        };
      default:
        return {
          icon: <BellIcon size={16} color="#9ca3af" />,
          message: 'sent a notification',
          color: '#9ca3af',
        };
    }
  };

  const {icon, message, color} = getNotificationContent();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress(author.handle);
    }
  };

  // Get post text if available using type guard
  const postText = AppBskyFeedPost.isRecord(notification.record)
    ? notification.record.text || ''
    : '';

  return (
    <TouchableOpacity
      style={[styles.container, !notification.isRead && styles.unread]}
      onPress={onPress}
      activeOpacity={0.9}>
      <View style={styles.content}>
        {/* Icon indicator */}
        <View style={[styles.iconContainer, {backgroundColor: color + '20'}]}>
          {icon}
        </View>

        {/* Author info and notification message */}
        <View style={styles.main}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleProfilePress}
              activeOpacity={0.7}
              style={styles.avatarContainer}>
              <Avatar uri={author.avatar} size={36} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {author.displayName || author.handle}
                </Text>
                <Text style={styles.message}> {message}</Text>
              </View>
              <Text style={styles.handle} numberOfLines={1}>
                @{author.handle}
              </Text>
            </View>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>

          {/* Post preview if available */}
          {postText && (
            <View style={styles.postPreview}>
              <Text style={styles.postText} numberOfLines={3}>
                {postText}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Unread indicator */}
      {!notification.isRead && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    position: 'relative',
  },
  unread: {
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  avatarContainer: {
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  displayName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    color: '#9ca3af',
    fontSize: 15,
  },
  handle: {
    color: '#6b7280',
    fontSize: 13,
  },
  timestamp: {
    color: '#6b7280',
    fontSize: 12,
    marginLeft: 8,
  },
  postPreview: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  postText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 18,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 4,
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    transform: [{translateY: -3}],
  },
});
