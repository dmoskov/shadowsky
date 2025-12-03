/**
 * Notification Grouping Service
 *
 * Implements smart notification aggregation and grouping with support for:
 * - Thread-based grouping for DM conversations
 * - Smart aggregation rules (multiple likes, follows, etc.)
 * - Rich notification content with media preview support
 * - Time-window based clustering
 */

import type { AppBskyNotificationListNotifications } from "@atproto/api";
import type { PushNotificationPayload } from "../types/push-notifications";
import { createLogger } from "../utils/logger";

const logger = createLogger("NotificationGroupingService");

type Notification = AppBskyNotificationListNotifications.Notification;

/**
 * Notification group types
 */
export type NotificationGroupType =
  | "likes"
  | "reposts"
  | "follows"
  | "mentions"
  | "replies"
  | "quotes"
  | "dm_thread"
  | "single";

/**
 * Grouped notification structure
 */
export interface GroupedNotification {
  id: string;
  type: NotificationGroupType;
  reason: string;
  count: number;
  notifications: Notification[];
  users: NotificationUser[];
  latestTimestamp: string;
  oldestTimestamp: string;
  groupKey: string;
  postUri?: string;
  postPreview?: PostPreview;
  conversationId?: string;
  isRead: boolean;
}

/**
 * User info for grouped notifications
 */
export interface NotificationUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Post preview for rich notifications
 */
export interface PostPreview {
  text?: string;
  hasImages: boolean;
  imageCount: number;
  imageThumbnails: string[];
  hasVideo: boolean;
  authorHandle: string;
  authorDisplayName?: string;
  authorAvatar?: string;
}

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  /** Time window in milliseconds for grouping notifications */
  timeWindowMs: number;
  /** Minimum count before aggregating */
  minAggregationCount: Record<string, number>;
  /** Maximum users to show in summary */
  maxDisplayUsers: number;
  /** Enable DM threading */
  enableDmThreading: boolean;
  /** Maximum notifications per group */
  maxNotificationsPerGroup: number;
}

/**
 * Default aggregation configuration
 */
export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  timeWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  minAggregationCount: {
    like: 3,
    repost: 3,
    follow: 2,
    quote: 2,
    mention: 1, // Don't aggregate mentions - show individually
    reply: 1, // Don't aggregate replies - show individually
  },
  maxDisplayUsers: 5,
  enableDmThreading: true,
  maxNotificationsPerGroup: 100,
};

/**
 * Notification Grouping Service
 */
class NotificationGroupingService {
  private static instance: NotificationGroupingService;
  private config: AggregationConfig = DEFAULT_AGGREGATION_CONFIG;

  private constructor() {}

  static getInstance(): NotificationGroupingService {
    if (!NotificationGroupingService.instance) {
      NotificationGroupingService.instance = new NotificationGroupingService();
    }
    return NotificationGroupingService.instance;
  }

  /**
   * Update aggregation configuration
   */
  setConfig(config: Partial<AggregationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AggregationConfig {
    return { ...this.config };
  }

  /**
   * Group notifications with smart aggregation rules
   */
  groupNotifications(notifications: Notification[]): GroupedNotification[] {
    if (!notifications.length) {
      return [];
    }

    const grouped: GroupedNotification[] = [];
    const groups = new Map<string, Notification[]>();

    // Sort notifications by timestamp (newest first)
    const sortedNotifications = [...notifications].sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
    );

    // Group notifications by type and context
    for (const notification of sortedNotifications) {
      const groupKey = this.getGroupKey(notification);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(notification);
    }

    // Process each group
    for (const [groupKey, groupNotifications] of groups) {
      const reason = groupNotifications[0].reason;
      const minCount = this.config.minAggregationCount[reason] ?? 1;

      if (groupNotifications.length >= minCount) {
        // Create aggregated group with time-window clustering
        const clusteredGroups = this.clusterByTimeWindow(groupNotifications);

        for (const cluster of clusteredGroups) {
          if (cluster.length >= minCount) {
            grouped.push(this.createGroupedNotification(cluster, groupKey));
          } else {
            // Add as individual notifications
            for (const notification of cluster) {
              grouped.push(this.createSingleNotification(notification));
            }
          }
        }
      } else {
        // Not enough to aggregate, add individually
        for (const notification of groupNotifications) {
          grouped.push(this.createSingleNotification(notification));
        }
      }
    }

    // Sort all groups by latest timestamp
    return grouped.sort(
      (a, b) =>
        new Date(b.latestTimestamp).getTime() -
        new Date(a.latestTimestamp).getTime(),
    );
  }

  /**
   * Generate summary text for aggregated notification
   */
  generateSummaryText(group: GroupedNotification): string {
    const count = group.count;
    const users = group.users;

    switch (group.reason) {
      case "like":
        return this.formatUserSummary(users, count, "liked your post");
      case "repost":
        return this.formatUserSummary(users, count, "reposted your post");
      case "follow":
        return this.formatUserSummary(users, count, "followed you");
      case "quote":
        return this.formatUserSummary(users, count, "quoted your post");
      case "mention":
        return this.formatUserSummary(users, count, "mentioned you");
      case "reply":
        return this.formatUserSummary(users, count, "replied to your post");
      default:
        return `${count} new notifications`;
    }
  }

  /**
   * Generate rich notification payload for push notification
   */
  generateRichNotificationPayload(
    group: GroupedNotification,
  ): PushNotificationPayload {
    const title = this.getNotificationTitle(group);
    const body = this.generateSummaryText(group);

    const payload: PushNotificationPayload = {
      type: "notification",
      title,
      body,
      icon: this.getGroupIcon(group),
      badge: "/butterfly-icon.svg",
      tag: group.groupKey,
      data: {
        reason: group.reason,
        postUri: group.postUri,
        url: this.getNotificationUrl(group),
      },
      requireInteraction: this.shouldRequireInteraction(group),
      renotify: true,
    };

    // Add inline actions based on notification type
    payload.actions = this.getNotificationActions(group);

    return payload;
  }

  /**
   * Group DM notifications by conversation (threading)
   */
  groupDmNotifications(
    notifications: Notification[],
    conversationMap: Map<string, string>,
  ): GroupedNotification[] {
    if (!this.config.enableDmThreading) {
      return notifications.map((n) => this.createSingleNotification(n));
    }

    const dmGroups = new Map<string, Notification[]>();

    for (const notification of notifications) {
      // Assume DM notifications have a conversation ID in the subject or URI
      const conversationId =
        conversationMap.get(notification.uri) || notification.uri;

      if (!dmGroups.has(conversationId)) {
        dmGroups.set(conversationId, []);
      }
      dmGroups.get(conversationId)!.push(notification);
    }

    return Array.from(dmGroups.values()).map((group) => {
      const sortedGroup = group.sort(
        (a, b) =>
          new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
      );

      return {
        id: `dm-thread-${sortedGroup[0].uri}`,
        type: "dm_thread" as NotificationGroupType,
        reason: "dm",
        count: sortedGroup.length,
        notifications: sortedGroup,
        users: this.extractUniqueUsers(sortedGroup),
        latestTimestamp: sortedGroup[0].indexedAt,
        oldestTimestamp: sortedGroup[sortedGroup.length - 1].indexedAt,
        groupKey: `dm-${sortedGroup[0].author.did}`,
        conversationId: sortedGroup[0].author.did,
        isRead: sortedGroup.every((n) => n.isRead),
      };
    });
  }

  /**
   * Collapse rapid notifications into a summary
   */
  collapseRapidNotifications(
    notifications: Notification[],
    thresholdMs: number = 5000, // 5 seconds
  ): GroupedNotification[] {
    if (notifications.length < 2) {
      return notifications.map((n) => this.createSingleNotification(n));
    }

    const groups: Notification[][] = [];
    let currentGroup: Notification[] = [notifications[0]];

    for (let i = 1; i < notifications.length; i++) {
      const timeDiff =
        new Date(notifications[i - 1].indexedAt).getTime() -
        new Date(notifications[i].indexedAt).getTime();

      if (timeDiff <= thresholdMs) {
        currentGroup.push(notifications[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [notifications[i]];
      }
    }
    groups.push(currentGroup);

    return groups.map((group) => {
      if (group.length === 1) {
        return this.createSingleNotification(group[0]);
      }
      return this.createGroupedNotification(group, `rapid-${Date.now()}`);
    });
  }

  /**
   * Extract post preview for rich notifications
   */
  extractPostPreview(
    notification: Notification,
    postData?: Record<string, unknown>,
  ): PostPreview | undefined {
    if (
      !notification.record ||
      typeof notification.record !== "object" ||
      !("text" in notification.record)
    ) {
      return undefined;
    }

    const record = notification.record as {
      text?: string;
      embed?: Record<string, unknown>;
    };

    const preview: PostPreview = {
      text: record.text,
      hasImages: false,
      imageCount: 0,
      imageThumbnails: [],
      hasVideo: false,
      authorHandle: notification.author.handle,
      authorDisplayName: notification.author.displayName,
      authorAvatar: notification.author.avatar,
    };

    // Check for embedded images
    if (record.embed) {
      const embed = record.embed;
      if (
        embed.$type === "app.bsky.embed.images" &&
        Array.isArray(embed.images)
      ) {
        preview.hasImages = true;
        preview.imageCount = embed.images.length;
        preview.imageThumbnails = embed.images
          .slice(0, 4)
          .map((img: Record<string, unknown>) => (img.thumb as string) || "")
          .filter(Boolean);
      }

      if (
        embed.$type === "app.bsky.embed.video" ||
        embed.$type === "app.bsky.embed.external"
      ) {
        const externalEmbed = embed as { external?: { uri?: string } };
        if (
          externalEmbed.external?.uri?.includes("youtube") ||
          externalEmbed.external?.uri?.includes("vimeo")
        ) {
          preview.hasVideo = true;
        }
      }
    }

    // If postData is provided, use it for richer preview
    if (postData) {
      const postEmbed = postData.embed as Record<string, unknown> | undefined;
      if (postEmbed?.$type === "app.bsky.embed.images#view") {
        const images = (postEmbed.images as Array<{ thumb: string }>) || [];
        preview.hasImages = true;
        preview.imageCount = images.length;
        preview.imageThumbnails = images.slice(0, 4).map((img) => img.thumb);
      }
    }

    return preview;
  }

  /**
   * Private: Get group key for a notification
   */
  private getGroupKey(notification: Notification): string {
    const reason = notification.reason;

    // Group follows together regardless of target
    if (reason === "follow") {
      return "follow-all";
    }

    // Group likes/reposts/quotes by the post they're on
    if (["like", "repost", "quote"].includes(reason)) {
      const postUri = notification.reasonSubject || notification.uri;
      return `${reason}-${postUri}`;
    }

    // Don't group mentions and replies - they're more important individually
    return `${reason}-${notification.uri}`;
  }

  /**
   * Private: Cluster notifications by time window
   */
  private clusterByTimeWindow(notifications: Notification[]): Notification[][] {
    if (notifications.length === 0) return [];

    const clusters: Notification[][] = [];
    let currentCluster: Notification[] = [notifications[0]];

    for (let i = 1; i < notifications.length; i++) {
      const timeDiff =
        new Date(notifications[i - 1].indexedAt).getTime() -
        new Date(notifications[i].indexedAt).getTime();

      if (timeDiff <= this.config.timeWindowMs) {
        currentCluster.push(notifications[i]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [notifications[i]];
      }
    }
    clusters.push(currentCluster);

    return clusters;
  }

  /**
   * Private: Extract unique users from notifications
   */
  private extractUniqueUsers(
    notifications: Notification[],
  ): NotificationUser[] {
    const userMap = new Map<string, NotificationUser>();

    for (const notification of notifications) {
      if (!userMap.has(notification.author.did)) {
        userMap.set(notification.author.did, {
          did: notification.author.did,
          handle: notification.author.handle,
          displayName: notification.author.displayName,
          avatar: notification.author.avatar,
        });
      }
    }

    return Array.from(userMap.values()).slice(0, this.config.maxDisplayUsers);
  }

  /**
   * Private: Create grouped notification
   */
  private createGroupedNotification(
    notifications: Notification[],
    groupKey: string,
  ): GroupedNotification {
    const sortedNotifications = [...notifications].sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
    );

    const reason = sortedNotifications[0].reason;
    const type = this.getNotificationGroupType(reason);

    return {
      id: `group-${groupKey}-${Date.now()}`,
      type,
      reason,
      count: sortedNotifications.length,
      notifications: sortedNotifications.slice(
        0,
        this.config.maxNotificationsPerGroup,
      ),
      users: this.extractUniqueUsers(sortedNotifications),
      latestTimestamp: sortedNotifications[0].indexedAt,
      oldestTimestamp:
        sortedNotifications[sortedNotifications.length - 1].indexedAt,
      groupKey,
      postUri:
        sortedNotifications[0].reasonSubject || sortedNotifications[0].uri,
      isRead: sortedNotifications.every((n) => n.isRead),
    };
  }

  /**
   * Private: Create single notification wrapper
   */
  private createSingleNotification(
    notification: Notification,
  ): GroupedNotification {
    return {
      id: `single-${notification.uri}`,
      type: "single",
      reason: notification.reason,
      count: 1,
      notifications: [notification],
      users: [
        {
          did: notification.author.did,
          handle: notification.author.handle,
          displayName: notification.author.displayName,
          avatar: notification.author.avatar,
        },
      ],
      latestTimestamp: notification.indexedAt,
      oldestTimestamp: notification.indexedAt,
      groupKey: notification.uri,
      postUri: notification.reasonSubject || notification.uri,
      isRead: notification.isRead,
    };
  }

  /**
   * Private: Get notification group type from reason
   */
  private getNotificationGroupType(reason: string): NotificationGroupType {
    switch (reason) {
      case "like":
        return "likes";
      case "repost":
        return "reposts";
      case "follow":
        return "follows";
      case "mention":
        return "mentions";
      case "reply":
        return "replies";
      case "quote":
        return "quotes";
      default:
        return "single";
    }
  }

  /**
   * Private: Format user summary text
   */
  private formatUserSummary(
    users: NotificationUser[],
    count: number,
    action: string,
  ): string {
    if (count === 1 && users.length === 1) {
      const name = users[0].displayName || `@${users[0].handle}`;
      return `${name} ${action}`;
    }

    if (users.length === 1) {
      const name = users[0].displayName || `@${users[0].handle}`;
      return `${name} and ${count - 1} others ${action}`;
    }

    if (users.length === 2) {
      const name1 = users[0].displayName || `@${users[0].handle}`;
      const name2 = users[1].displayName || `@${users[1].handle}`;
      if (count === 2) {
        return `${name1} and ${name2} ${action}`;
      }
      return `${name1}, ${name2} and ${count - 2} others ${action}`;
    }

    const displayNames = users
      .slice(0, this.config.maxDisplayUsers)
      .map((u) => u.displayName || `@${u.handle}`);
    const remaining = count - displayNames.length;

    if (remaining > 0) {
      return `${displayNames.join(", ")} and ${remaining} others ${action}`;
    }

    return `${displayNames.join(", ")} ${action}`;
  }

  /**
   * Private: Get notification title
   */
  private getNotificationTitle(group: GroupedNotification): string {
    switch (group.reason) {
      case "like":
        return group.count === 1 ? "New Like" : `${group.count} New Likes`;
      case "repost":
        return group.count === 1 ? "New Repost" : `${group.count} New Reposts`;
      case "follow":
        return group.count === 1
          ? "New Follower"
          : `${group.count} New Followers`;
      case "mention":
        return "You were mentioned";
      case "reply":
        return "New Reply";
      case "quote":
        return group.count === 1 ? "New Quote" : `${group.count} New Quotes`;
      default:
        return "New Notification";
    }
  }

  /**
   * Private: Get icon for notification group
   */
  private getGroupIcon(group: GroupedNotification): string {
    // Use the first user's avatar if available, otherwise default icon
    if (group.users.length > 0 && group.users[0].avatar) {
      return group.users[0].avatar;
    }
    return "/butterfly-icon.svg";
  }

  /**
   * Private: Get URL for notification
   */
  private getNotificationUrl(group: GroupedNotification): string {
    if (group.reason === "follow") {
      return "/notifications?filter=follows";
    }

    if (group.postUri) {
      // Extract handle and post ID from URI
      const match = group.postUri.match(
        /at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)/,
      );
      if (match) {
        return `/thread/${match[1]}/${match[2]}`;
      }
    }

    return "/notifications";
  }

  /**
   * Private: Determine if notification should require interaction
   */
  private shouldRequireInteraction(group: GroupedNotification): boolean {
    // Mentions and replies are more important
    return ["mention", "reply"].includes(group.reason);
  }

  /**
   * Private: Get notification actions based on type
   */
  private getNotificationActions(
    group: GroupedNotification,
  ): Array<{ action: string; title: string; icon?: string }> {
    const actions: Array<{ action: string; title: string; icon?: string }> = [];

    switch (group.reason) {
      case "like":
      case "repost":
      case "quote":
        actions.push({ action: "view", title: "View Post" });
        break;
      case "follow":
        actions.push({ action: "view_profile", title: "View Profile" });
        break;
      case "mention":
      case "reply":
        actions.push(
          { action: "view", title: "View" },
          { action: "reply", title: "Reply" },
        );
        break;
    }

    // Always add dismiss action
    actions.push({ action: "dismiss", title: "Dismiss" });

    return actions;
  }
}

// Export singleton instance
export const notificationGroupingService =
  NotificationGroupingService.getInstance();

// Export class for testing
export { NotificationGroupingService };
