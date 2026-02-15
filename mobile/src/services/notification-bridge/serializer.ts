/**
 * Notification Data Serializer
 *
 * Transforms AT Protocol notification data from @atproto/api into a format
 * optimized for Swift consumption via JSON serialization.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { AppBskyNotificationListNotifications, AppBskyFeedPost } from '@atproto/api';
import { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { ProcessedNotification } from '../../utils/notification-aggregator';

// Types for serialized notifications
interface SerializedNotificationAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface SerializedNotificationFacetIndex {
  byteStart: number;
  byteEnd: number;
}

interface SerializedNotificationFacetFeature {
  $type: string;
  did?: string;
  uri?: string;
  tag?: string;
}

interface SerializedNotificationFacet {
  index: SerializedNotificationFacetIndex;
  features: SerializedNotificationFacetFeature[];
}

interface SerializedNotificationRecord {
  text?: string;
  facets?: SerializedNotificationFacet[];
  createdAt: string;
}

interface SerializedNotificationLabel {
  val: string;
  src: string;
}

interface SerializedNotification {
  uri: string;
  cid: string;
  author: SerializedNotificationAuthor;
  reason: string;
  reasonSubject?: string;
  record?: SerializedNotificationRecord;
  isRead: boolean;
  indexedAt: string;
  labels?: SerializedNotificationLabel[];
}

interface SerializedNotificationUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface SerializedAggregatedNotification {
  type: 'aggregated';
  reason: string;
  count: number;
  users: SerializedNotificationUser[];
  latestTimestamp: string;
  notifications: SerializedNotification[];
  targetPostUri?: string;
}

interface SerializedSingleNotification {
  type: 'single';
  notification: SerializedNotification;
}

type SerializedProcessedNotification = SerializedSingleNotification | SerializedAggregatedNotification;

interface NotificationUpdateMetadata {
  timestamp: number;
  isOnline: boolean;
}

interface SerializedNotificationData {
  notifications: SerializedProcessedNotification[];
  metadata: NotificationUpdateMetadata;
  cursor?: string;
}

export interface NotificationSerializerOptions {
  isOnline?: boolean;
}

export interface NotificationSerializerResult {
  serializedJSON: string | null;
}

// Notification query type
type NotificationPage = {
  notifications: AppBskyNotificationListNotifications.Notification[];
  cursor?: string;
};
export type NotificationQuery = UseInfiniteQueryResult<InfiniteData<NotificationPage>, Error>;

/**
 * Serialize notification author
 */
function serializeNotificationAuthor(author: any): SerializedNotificationAuthor {
  return {
    did: author.did,
    handle: author.handle,
    displayName: author.displayName,
    avatar: author.avatar,
  };
}

/**
 * Serialize rich text facets
 */
function serializeNotificationFacets(facets: unknown[] | undefined): SerializedNotificationFacet[] | undefined {
  if (!facets || facets.length === 0) return undefined;

  return facets.map((facet: any) => ({
    index: {
      byteStart: facet.index.byteStart,
      byteEnd: facet.index.byteEnd,
    },
    features: facet.features.map((feature: any) => {
      if (feature.$type === 'app.bsky.richtext.facet#mention') {
        return {
          $type: 'app.bsky.richtext.facet#mention',
          did: feature.did,
        };
      } else if (feature.$type === 'app.bsky.richtext.facet#link') {
        return {
          $type: 'app.bsky.richtext.facet#link',
          uri: feature.uri,
        };
      } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
        return {
          $type: 'app.bsky.richtext.facet#tag',
          tag: feature.tag,
        };
      }
      return feature;
    }),
  }));
}

/**
 * Serialize notification record
 */
function serializeNotificationRecord(record: any): SerializedNotificationRecord | undefined {
  if (!record) return undefined;

  // Check if it's a post record
  if (AppBskyFeedPost.isRecord(record)) {
    return {
      text: record.text,
      facets: serializeNotificationFacets(record.facets),
      createdAt: record.createdAt,
    };
  }

  return undefined;
}

/**
 * Serialize notification labels
 */
function serializeNotificationLabels(labels: any[] | undefined): SerializedNotificationLabel[] | undefined {
  if (!labels || labels.length === 0) return undefined;

  return labels.map(label => ({
    val: label.val,
    src: label.src,
  }));
}

/**
 * Serialize a single notification
 */
function serializeSingleNotification(
  notification: AppBskyNotificationListNotifications.Notification
): SerializedNotification {
  return {
    uri: notification.uri,
    cid: notification.cid,
    author: serializeNotificationAuthor(notification.author),
    reason: notification.reason,
    reasonSubject: notification.reasonSubject,
    record: serializeNotificationRecord(notification.record),
    isRead: notification.isRead,
    indexedAt: notification.indexedAt,
    labels: serializeNotificationLabels(notification.labels),
  };
}

/**
 * Serialize processed notifications
 */
function serializeProcessedNotifications(
  processedNotifications: ProcessedNotification[]
): SerializedProcessedNotification[] {
  return processedNotifications.map(item => {
    if (item.type === 'aggregated') {
      return {
        type: 'aggregated',
        reason: item.reason,
        count: item.count,
        users: item.users.map(user => ({
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
          avatar: user.avatar,
        })),
        latestTimestamp: item.latestTimestamp,
        notifications: item.notifications.map(serializeSingleNotification),
        targetPostUri: item.targetPostUri,
      } as SerializedAggregatedNotification;
    } else {
      return {
        type: 'single',
        notification: serializeSingleNotification(item.notification),
      } as SerializedSingleNotification;
    }
  });
}

/**
 * Hook to serialize processed notifications for Swift consumption
 */
export function useCompleteNotificationSerializer(
  processedNotifications: ProcessedNotification[],
  cursor: string | undefined,
  options: NotificationSerializerOptions = {}
): NotificationSerializerResult {
  const { isOnline = true } = options;

  const serializedJSON = useMemo(() => {
    if (!processedNotifications || processedNotifications.length === 0) {
      return null;
    }

    const serializedData: SerializedNotificationData = {
      notifications: serializeProcessedNotifications(processedNotifications),
      metadata: {
        timestamp: Date.now(),
        isOnline,
      },
      cursor,
    };

    return JSON.stringify(serializedData);
  }, [processedNotifications, cursor, isOnline]);

  return { serializedJSON };
}
