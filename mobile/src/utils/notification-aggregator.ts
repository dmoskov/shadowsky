/**
 * Mobile Notification Aggregation Utilities
 * Adapted from web NotificationAggregator for React Native
 */

import {AppBskyNotificationListNotifications} from '@atproto/api';

type Notification = AppBskyNotificationListNotifications.Notification;

export interface AggregatedNotification {
  type: 'aggregated';
  reason: string;
  count: number;
  users: Array<{
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  }>;
  latestTimestamp: string;
  notifications: Notification[];
  targetPostUri?: string;
}

export interface SingleNotification {
  type: 'single';
  notification: Notification;
}

export type ProcessedNotification = AggregatedNotification | SingleNotification;

/**
 * Aggregate notifications with smart grouping
 */
export function aggregateNotifications(
  notifications: Notification[],
): ProcessedNotification[] {
  const processed: ProcessedNotification[] = [];
  const aggregationWindow = 24 * 60 * 60 * 1000; // 24 hours

  // Group notifications by reason and target post
  const groups = new Map<string, Notification[]>();

  notifications.forEach(notification => {
    // Only aggregate certain types
    if (
      ['like', 'repost', 'follow', 'quote', 'starterpack-joined'].includes(
        notification.reason,
      )
    ) {
      // For follows and starterpack-joined, group all together
      // For likes/reposts, group by reasonSubject (the post being liked/reposted)
      // For quotes, group by uri (the quoting post)
      let key: string;
      if (['follow', 'starterpack-joined'].includes(notification.reason)) {
        key = `${notification.reason}-all`;
      } else if (['like', 'repost'].includes(notification.reason)) {
        // Use reasonSubject for likes/reposts - this is the post being acted upon
        key = `${notification.reason}-${notification.reasonSubject || notification.uri || 'no-uri'}`;
      } else {
        // For quotes, use uri
        key = `${notification.reason}-${notification.uri || 'no-uri'}`;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(notification);
    } else {
      // Don't aggregate replies, mentions - they're more important individually
      processed.push({type: 'single', notification});
    }
  });

  // Process groups
  groups.forEach((groupNotifications, key) => {
    const [reason] = key.split('-');

    // Sort by timestamp (newest first)
    groupNotifications.sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
    );

    // Different thresholds for different notification types
    const minAggregationCount = reason === 'follow' ? 2 : 3;

    // Check if we should aggregate
    if (groupNotifications.length >= minAggregationCount) {
      // Find time clusters
      const clusters: Notification[][] = [];
      let currentCluster: Notification[] = [groupNotifications[0]];

      for (let i = 1; i < groupNotifications.length; i++) {
        const timeDiff =
          new Date(groupNotifications[i - 1].indexedAt).getTime() -
          new Date(groupNotifications[i].indexedAt).getTime();

        if (timeDiff <= aggregationWindow) {
          currentCluster.push(groupNotifications[i]);
        } else {
          // Process current cluster
          if (currentCluster.length >= minAggregationCount) {
            clusters.push(currentCluster);
          } else {
            // Add as individual notifications
            currentCluster.forEach(n =>
              processed.push({type: 'single', notification: n}),
            );
          }
          currentCluster = [groupNotifications[i]];
        }
      }

      // Handle last cluster
      if (currentCluster.length >= minAggregationCount) {
        clusters.push(currentCluster);
      } else {
        currentCluster.forEach(n =>
          processed.push({type: 'single', notification: n}),
        );
      }

      // Create aggregated notifications for clusters
      clusters.forEach(cluster => {
        const uniqueUsers = new Map<string, (typeof cluster)[0]['author']>();
        cluster.forEach(n => {
          uniqueUsers.set(n.author.did, n.author);
        });

        // Get the target post URI for likes/reposts
        const firstNotification = cluster[0];
        const targetPostUri = ['like', 'repost'].includes(reason)
          ? firstNotification.reasonSubject || firstNotification.uri
          : firstNotification.uri;

        const aggregated: AggregatedNotification = {
          type: 'aggregated',
          reason,
          count: cluster.length,
          users: Array.from(uniqueUsers.values()).map(author => ({
            did: author.did,
            handle: author.handle,
            displayName: author.displayName,
            avatar: author.avatar,
          })),
          latestTimestamp: cluster[0].indexedAt,
          notifications: cluster,
          targetPostUri,
        };

        processed.push(aggregated);
      });
    } else {
      // Too few to aggregate
      groupNotifications.forEach(n =>
        processed.push({type: 'single', notification: n}),
      );
    }
  });

  // Sort all processed notifications by latest timestamp
  processed.sort((a, b) => {
    const timeA =
      a.type === 'single'
        ? new Date(a.notification.indexedAt).getTime()
        : new Date(a.latestTimestamp).getTime();
    const timeB =
      b.type === 'single'
        ? new Date(b.notification.indexedAt).getTime()
        : new Date(b.latestTimestamp).getTime();
    return timeB - timeA;
  });

  return processed;
}

/**
 * Filter notifications by type
 */
export function filterNotificationsByType(
  notifications: Notification[],
  filter: 'all' | 'likes' | 'replies' | 'follows' | 'mentions' | 'quotes',
): Notification[] {
  if (filter === 'all') {
    return notifications;
  }

  const reasonMap: Record<string, string[]> = {
    likes: ['like'],
    replies: ['reply'],
    follows: ['follow'],
    mentions: ['mention'],
    quotes: ['quote'],
  };

  const reasons = reasonMap[filter] || [];
  return notifications.filter(n => reasons.includes(n.reason));
}

/**
 * Filter already-processed (aggregated) notifications by type.
 * This avoids re-running the expensive aggregation when only the filter changes.
 */
export function filterProcessedNotifications(
  processed: ProcessedNotification[],
  filter: 'all' | 'likes' | 'replies' | 'follows' | 'mentions' | 'quotes',
): ProcessedNotification[] {
  if (filter === 'all') {
    return processed;
  }

  const reasonMap: Record<string, string[]> = {
    likes: ['like'],
    replies: ['reply'],
    follows: ['follow'],
    mentions: ['mention'],
    quotes: ['quote'],
  };

  const reasons = reasonMap[filter] || [];
  return processed.filter(item => {
    if (item.type === 'aggregated') {
      return reasons.includes(item.reason);
    }
    return reasons.includes(item.notification.reason);
  });
}

/**
 * Count notifications by type
 */
export function countNotificationsByType(
  notifications: Notification[],
): Record<string, number> {
  const counts: Record<string, number> = {
    all: notifications.length,
    likes: 0,
    replies: 0,
    follows: 0,
    mentions: 0,
    quotes: 0,
  };

  notifications.forEach(notification => {
    switch (notification.reason) {
      case 'like':
        counts.likes++;
        break;
      case 'reply':
        counts.replies++;
        break;
      case 'follow':
        counts.follows++;
        break;
      case 'mention':
        counts.mentions++;
        break;
      case 'quote':
        counts.quotes++;
        break;
    }
  });

  return counts;
}
