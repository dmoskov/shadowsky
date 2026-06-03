/**
 * Pure analytics helpers for NotificationsAnalytics.
 *
 * Extracted from the component so the time-bucketing / aggregation logic is
 * unit-testable. `now` is injected (defaults to the current time) to keep the
 * computation deterministic.
 */

import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { format, startOfDay, subDays, subHours } from "date-fns";

export type TimeRange = "1d" | "3d" | "7d" | "4w";

type Notification = AppBskyNotificationListNotifications.Notification;

export interface AnalyticsBucket {
  startDate: Date;
  endDate: Date;
  label: string;
  likes: number;
  reposts: number;
  follows: number;
  replies: number;
  mentions: number;
  total: number;
}

export interface TopUser {
  handle: string;
  count: number;
  user: Notification["author"] | undefined;
}

export interface NotificationActivity {
  buckets: AnalyticsBucket[];
  topUsers: TopUser[];
  totalEngagement: number;
  uniqueUsers: number;
  averagePerDay: number;
  averagePerHour: number;
  daySpan: number;
  oldestDate: Date;
  newestDate: Date;
  timeRange: TimeRange;
}

const TIME_RANGE_HOURS: Record<TimeRange, number> = {
  "1d": 24,
  "3d": 72,
  "7d": 168,
  "4w": 672,
};

/**
 * Build the time-bucketed activity breakdown for a set of notifications within
 * the selected time range.
 */
export function buildNotificationActivity(
  notifications: Notification[],
  timeRange: TimeRange,
  now: Date = new Date(),
): NotificationActivity {
  const cutoffDate = subHours(now, TIME_RANGE_HOURS[timeRange]);
  const filteredNotifications = notifications.filter(
    (n) => new Date(n.indexedAt) >= cutoffDate,
  );

  // Calculate the actual date range of the filtered data
  const sortedNotifications =
    filteredNotifications.length > 0
      ? [...filteredNotifications].sort(
          (a, b) =>
            new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime(),
        )
      : [];

  const oldestDate =
    sortedNotifications.length > 0
      ? new Date(sortedNotifications[0].indexedAt)
      : cutoffDate;
  const newestDate =
    sortedNotifications.length > 0
      ? new Date(sortedNotifications[sortedNotifications.length - 1].indexedAt)
      : now;

  // Create time buckets based on the selected range
  const buckets: AnalyticsBucket[] = [];

  const emptyCounts = {
    likes: 0,
    reposts: 0,
    follows: 0,
    replies: 0,
    mentions: 0,
    total: 0,
  };

  if (timeRange === "1d") {
    // Hourly buckets for last 24 hours (group by 2-hour chunks)
    for (let i = 11; i >= 0; i--) {
      const endDate = subHours(now, i * 2);
      const startDate = subHours(now, (i + 1) * 2);

      // Check if this bucket is today or yesterday
      const isToday = endDate.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = endDate.toDateString() === yesterday.toDateString();

      let label = format(endDate, "h a");
      if (!isToday && isYesterday) {
        // Add "Yesterday" prefix for clarity only when it's actually yesterday
        label = `Yesterday ${format(endDate, "h a")}`;
      } else if (i === 0) {
        // Most recent bucket
        label = "Now";
      }

      buckets.push({ startDate, endDate, label, ...emptyCounts });
    }
  } else if (timeRange === "3d") {
    // 6-hour buckets for 3 days
    for (let i = 11; i >= 0; i--) {
      const endDate = subHours(now, i * 6);
      const startDate = subHours(now, (i + 1) * 6);
      buckets.push({
        startDate,
        endDate,
        label: i === 0 ? "Now" : format(endDate, "EEE h a"),
        ...emptyCounts,
      });
    }
  } else if (timeRange === "7d") {
    // Daily buckets for 7 days
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(now, i));
      const nextDate = startOfDay(subDays(now, i - 1));
      buckets.push({
        startDate: date,
        endDate: i === 0 ? now : nextDate,
        label: format(date, "EEE"),
        ...emptyCounts,
      });
    }
  } else {
    // Daily buckets for 4 weeks (28 days)
    for (let i = 27; i >= 0; i--) {
      const date = startOfDay(subDays(now, i));
      const nextDate = i === 0 ? now : startOfDay(subDays(now, i - 1));
      buckets.push({
        startDate: date,
        endDate: nextDate,
        label:
          i === 0 ? "Today" : i === 1 ? "Yesterday" : format(date, "MMM d"),
        ...emptyCounts,
      });
    }
  }

  // Count notifications by bucket and type
  filteredNotifications.forEach((notification) => {
    // Parse the UTC timestamp; it converts to local timezone automatically
    const notifDate = new Date(notification.indexedAt);
    const bucket = buckets.find(
      (b) => notifDate >= b.startDate && notifDate < b.endDate,
    );

    if (bucket) {
      bucket.total++;
      switch (notification.reason) {
        case "like":
          bucket.likes++;
          break;
        case "repost":
          bucket.reposts++;
          break;
        case "follow":
          bucket.follows++;
          break;
        case "reply":
          bucket.replies++;
          break;
        case "mention":
          bucket.mentions++;
          break;
      }
    }
  });

  // Find most active users (excluding starterpack-joined notifications)
  const userActivity = new Map<string, number>();
  filteredNotifications.forEach((notification) => {
    if (notification.reason !== "starterpack-joined") {
      const key = notification.author.handle;
      userActivity.set(key, (userActivity.get(key) || 0) + 1);
    }
  });

  const topUsers: TopUser[] = Array.from(userActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([handle, count]) => {
      const user = filteredNotifications.find(
        (n) => n.author.handle === handle,
      )?.author;
      return { handle, count, user };
    });

  // Calculate engagement rate
  const totalEngagement = filteredNotifications.length;
  const uniqueUsers =
    filteredNotifications.length > 0
      ? new Set(filteredNotifications.map((n) => n.author.did)).size
      : 0;
  const hourSpan = Math.max(
    1,
    (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60),
  );
  const daySpan = Math.max(1, hourSpan / 24);

  return {
    buckets,
    topUsers,
    totalEngagement,
    uniqueUsers,
    averagePerDay: totalEngagement / daySpan,
    averagePerHour: totalEngagement / hourSpan,
    daySpan,
    oldestDate,
    newestDate,
    timeRange,
  };
}

export interface NotificationCounts {
  total: number;
  unread: number;
  likes: number;
  reposts: number;
  follows: number;
  mentions: number;
  replies: number;
}

/**
 * Count notifications by reason. `trackUnread` controls whether the unread
 * count is computed from `isRead` (extended-history pages don't carry read
 * status, so callers pass false there).
 */
export function countNotificationsByReason(
  notifications: Notification[],
  options: { trackUnread?: boolean } = {},
): NotificationCounts {
  const byReason = (reason: string) =>
    notifications.filter((n) => n.reason === reason).length;

  return {
    total: notifications.length,
    unread: options.trackUnread
      ? notifications.filter((n) => !n.isRead).length
      : 0,
    likes: byReason("like"),
    reposts: byReason("repost"),
    follows: byReason("follow"),
    mentions: byReason("mention"),
    replies: byReason("reply"),
  };
}

/** Notifications indexed within the last `hours` relative to `now`. */
export function recentNotifications(
  notifications: Notification[],
  hours: number,
  now: Date = new Date(),
): Notification[] {
  const cutoff = subHours(now, hours);
  return notifications.filter((n) => new Date(n.indexedAt) >= cutoff);
}
