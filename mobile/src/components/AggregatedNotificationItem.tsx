import React, {useState, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {AppBskyNotificationListNotifications} from '@atproto/api';
import {Avatar} from './Avatar';
import {formatDistanceToNow} from 'date-fns';
import {
  HeartIcon,
  RepostIcon,
  FollowIcon,
  QuoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './icons';
import { useTheme } from "../contexts/ThemeContext";
import {NotificationItem} from './NotificationItem';

interface AggregatedNotificationItemProps {
  notifications: AppBskyNotificationListNotifications.Notification[];
  reason: string;
  onPress?: () => void;
  onProfilePress?: (handle: string) => void;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
}

export function AggregatedNotificationItem({
  notifications,
  reason,
  onPress,
  onProfilePress: _onProfilePress,
  onMentionPress,
  onHashtagPress,
}: AggregatedNotificationItemProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Extract unique users
  const uniqueUsers = React.useMemo(() => {
    const userMap = new Map();
    notifications.forEach(notif => {
      if (!userMap.has(notif.author.did)) {
        userMap.set(notif.author.did, notif.author);
      }
    });
    return Array.from(userMap.values()).slice(0, 5);
  }, [notifications]);

  const count = notifications.length;
  const latestNotification = notifications[0];
  const hasUnread = notifications.some(n => !n.isRead);

  // Get icon and color based on reason
  const getIconAndColor = (): {icon: React.ReactNode; color: string} => {
    switch (reason) {
      case 'like':
        return {
          icon: <HeartIcon size={18} color={colors.danger} filled />,
          color: colors.danger,
        };
      case 'repost':
        return {
          icon: <RepostIcon size={18} color={colors.success} />,
          color: colors.success,
        };
      case 'follow':
        return {
          icon: <FollowIcon size={18} color={colors.primary} />,
          color: colors.primary,
        };
      case 'quote':
        return {
          icon: <QuoteIcon size={18} color={colors.quote} />,
          color: colors.quote,
        };
      default:
        return {
          icon: <HeartIcon size={18} color={colors.textSecondary} />,
          color: colors.textSecondary,
        };
    }
  };

  const {icon, color} = getIconAndColor();

  // Format user summary
  const formatUserSummary = () => {
    if (count === 1) {
      return uniqueUsers[0].displayName || `@${uniqueUsers[0].handle}`;
    }
    if (count === 2 && uniqueUsers.length === 2) {
      const name1 = uniqueUsers[0].displayName || `@${uniqueUsers[0].handle}`;
      const name2 = uniqueUsers[1].displayName || `@${uniqueUsers[1].handle}`;
      return `${name1} and ${name2}`;
    }
    const firstName = uniqueUsers[0].displayName || `@${uniqueUsers[0].handle}`;
    return `${firstName} and ${count - 1} ${count - 1 === 1 ? 'other' : 'others'}`;
  };

  const getActionText = () => {
    switch (reason) {
      case 'like':
        return 'liked your post';
      case 'repost':
        return 'reposted your post';
      case 'follow':
        return 'followed you';
      case 'quote':
        return 'quoted your post';
      default:
        return 'interacted with your post';
    }
  };

  const timestamp = formatDistanceToNow(new Date(latestNotification.indexedAt), {
    addSuffix: true,
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.mainContent, hasUnread && styles.unread]}
        onPress={onPress}
        activeOpacity={0.9}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, {backgroundColor: color + '20'}]}>
            {icon}
          </View>

          {/* Main content */}
          <View style={styles.main}>
            {/* Avatar stack */}
            <View style={styles.avatarStack}>
              {uniqueUsers.slice(0, 3).map((user, idx) => (
                <View
                  key={user.did}
                  style={[
                    styles.avatarWrapper,
                    {zIndex: uniqueUsers.length - idx, marginLeft: idx > 0 ? -12 : 0},
                  ]}>
                  <Avatar uri={user.avatar} size={32} />
                </View>
              ))}
              {uniqueUsers.length > 3 && (
                <View style={[styles.moreCount, {marginLeft: -12}]}>
                  <Text style={styles.moreCountText}>+{uniqueUsers.length - 3}</Text>
                </View>
              )}
            </View>

            {/* Summary text */}
            <View style={styles.textContainer}>
              <Text style={styles.summaryText}>
                <Text style={styles.userName}>{formatUserSummary()}</Text>
                <Text style={styles.actionText}> {getActionText()}</Text>
              </Text>
              <Text style={styles.timestamp}>{timestamp}</Text>
            </View>
          </View>
        </View>

        {/* Unread indicator */}
        {hasUnread && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>

      {/* Expand/collapse button */}
      {count > 1 && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}>
          <Text style={styles.expandText}>
            {isExpanded ? 'Collapse' : `Show all ${count} notifications`}
          </Text>
          {isExpanded ? (
            <ChevronUpIcon size={16} color={colors.textTertiary} />
          ) : (
            <ChevronDownIcon size={16} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
      )}

      {/* Expanded list */}
      {isExpanded && (
        <View style={styles.expandedList}>
          {notifications.map((notification, idx) => (
            <NotificationItem
              key={notification.uri + idx}
              notification={notification}
              onMentionPress={onMentionPress}
              onHashtagPress={onHashtagPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    mainContent: {
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarWrapper: {
      borderWidth: 2,
      borderColor: colors.background,
      borderRadius: 16,
    },
    moreCount: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreCountText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    textContainer: {
      flex: 1,
    },
    summaryText: {
      fontSize: 15,
      lineHeight: 20,
      marginBottom: 2,
    },
    userName: {
      color: colors.text,
      fontWeight: '600',
    },
    actionText: {
      color: colors.textSecondary,
    },
    timestamp: {
      color: colors.textTertiary,
      fontSize: 12,
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
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
    },
    expandText: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: '600',
    },
    expandedList: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
    },
  });
}
