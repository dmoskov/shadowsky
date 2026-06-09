/**
 * Notification aggregation utilities.
 *
 * The implementation lives in @bsky/core (packages/core/src/notifications/
 * aggregator.ts) so grouping behavior is single-sourced across web and
 * mobile. This module re-exports for existing import paths.
 */

export {
  type AggregatedNotification,
  type SingleNotification,
  type ProcessedNotification,
  type NotificationFilter,
  aggregateNotifications,
  filterNotificationsByType,
  filterProcessedNotifications,
  countNotificationsByType,
} from '@bsky/core';
