import React, {ReactNode, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {AppBskyNotificationListNotifications, AppBskyFeedPost, AppBskyRichtextFacet} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {HeartIcon, RepostIcon, FollowIcon, AtSignIcon, ReplyIcon, QuoteIcon, BellIcon} from './icons';
import {RichText} from '../utils/rich-text';
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface NotificationItemProps {
  notification: AppBskyNotificationListNotifications.Notification;
  onPress?: () => void;
  onProfilePress?: (handle: string) => void;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
}

const NotificationItemInner = React.memo(function NotificationItem({
  notification,
  onPress,
  onProfilePress,
  onMentionPress,
  onHashtagPress,
}: NotificationItemProps) {
  const { colors } = useTheme();
  const author = notification.author;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Format timestamp
  const timestamp = formatDistanceToNow(new Date(notification.indexedAt), {
    addSuffix: true,
  });

  // Get notification icon and message based on reason
  const getNotificationContent = (): {icon: ReactNode; message: string; color: string} => {
    switch (notification.reason) {
      case 'like':
        return {
          icon: <HeartIcon size={16} color={colors.like} filled />,
          message: 'liked your post',
          color: colors.like,
        };
      case 'repost':
        return {
          icon: <RepostIcon size={16} color={colors.repost} />,
          message: 'reposted your post',
          color: colors.repost,
        };
      case 'follow':
        return {
          icon: <FollowIcon size={16} color={colors.primary} />,
          message: 'followed you',
          color: colors.primary,
        };
      case 'mention':
        return {
          icon: <AtSignIcon size={16} color={colors.mention} />,
          message: 'mentioned you',
          color: colors.mention,
        };
      case 'reply':
        return {
          icon: <ReplyIcon size={16} color={colors.reply} />,
          message: 'replied to your post',
          color: colors.reply,
        };
      case 'quote':
        return {
          icon: <QuoteIcon size={16} color={colors.quote} />,
          message: 'quoted your post',
          color: colors.quote,
        };
      case 'like-via-repost':
        return {
          icon: <HeartIcon size={16} color={colors.like} filled />,
          message: 'liked your repost',
          color: colors.like,
        };
      case 'repost-via-repost':
        return {
          icon: <RepostIcon size={16} color={colors.repost} />,
          message: 'reposted your repost',
          color: colors.repost,
        };
      case 'starterpack-joined':
        return {
          icon: <FollowIcon size={16} color={colors.primary} />,
          message: 'joined from your starter pack',
          color: colors.primary,
        };
      default:
        return {
          icon: <BellIcon size={16} color={colors.textSecondary} />,
          message: 'sent a notification',
          color: colors.textSecondary,
        };
    }
  };

  const {icon, message, color} = getNotificationContent();

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress(author.handle);
    }
  };

  // Get post text and facets if available using type guard
  const postRecord = AppBskyFeedPost.isRecord(notification.record)
    ? notification.record
    : undefined;
  const postText = (postRecord && typeof postRecord.text === 'string') ? postRecord.text : '';
  const postPreview = postText ? `Post: ${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}` : '';

  const accessibilityLabel = `${author.displayName || author.handle} ${message}. ${postPreview} ${timestamp}. ${!notification.isRead ? 'Unread notification' : 'Read notification'}`;

  return (
    <TouchableOpacity
      style={[styles.container, !notification.isRead && styles.unread]}
      onPress={onPress}
      activeOpacity={0.9}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to view notification details"
      accessibilityState={{selected: !notification.isRead}}>
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
              style={styles.avatarContainer}
              accessibilityRole="button"
              accessibilityLabel={`View profile of ${author.displayName || author.handle}`}
              accessibilityHint="Double tap to open profile">
              <Avatar uri={author.avatar} size={36} accessibilityLabel={`${author.displayName || author.handle}'s avatar`} />
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
          {postText && postRecord && typeof postRecord.text === 'string' && (
            <View style={styles.postPreview}>
              <RichText
                text={postRecord.text}
                facets={postRecord.facets as AppBskyRichtextFacet.Main[] | undefined}
                onMentionPress={onMentionPress}
                onHashtagPress={onHashtagPress}
                style={styles.postText}
              />
            </View>
          )}
          {/* For likes/reposts, show tap hint since we don't have the post text */}
          {!postText && notification.reasonSubject && (
            <View style={styles.postPreview}>
              <Text style={styles.tapHint}>Tap to view post</Text>
            </View>
          )}
        </View>
      </View>

      {/* Unread indicator */}
      {!notification.isRead && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );
});

export { NotificationItemInner as NotificationItem };

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    unread: {
      backgroundColor: colors.unreadBackground,
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
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: '600',
    },
    message: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
    },
    handle: {
      color: colors.textTertiary,
      fontSize: fontSize.footnote,
    },
    timestamp: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      marginLeft: 8,
    },
    postPreview: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
    },
    postText: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 18,
    },
    tapHint: {
      color: colors.textTertiary,
      fontSize: fontSize.footnote,
      fontStyle: 'italic',
    },
    unreadIndicator: {
      position: 'absolute',
      left: 4,
      top: '50%',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      transform: [{translateY: -3}],
    },
  });
}
