/**
 * Notification Data Serializer
 *
 * Transforms AT Protocol notification data from @atproto/api into a format
 * optimized for Swift consumption via JSON serialization.
 */

import { useMemo } from 'react';
import { AppBskyNotificationListNotifications, AppBskyFeedPost, AppBskyFeedDefs } from '@atproto/api';
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

// Post preview types for rich notification rendering
interface SerializedPostPreviewImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

interface SerializedPostPreviewExternal {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

interface SerializedPostPreviewVideo {
  playlist: string;
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
}

interface SerializedPostPreview {
  uri: string;
  text?: string;
  author: SerializedNotificationAuthor;
  images?: SerializedPostPreviewImage[];
  video?: SerializedPostPreviewVideo;
  external?: SerializedPostPreviewExternal;
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
  postPreview?: SerializedPostPreview;
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
  postPreview?: SerializedPostPreview;
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
  postMap?: Map<string, AppBskyFeedDefs.PostView>;
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

  return facets
    .filter((facet: any) => facet?.index && Array.isArray(facet?.features))
    .map((facet: any) => ({
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
 * Serialize a post preview from a PostView for rich notification rendering
 */
function serializePostPreview(post: AppBskyFeedDefs.PostView): SerializedPostPreview {
  const embed = post.embed as any;
  const record = post.record as any;
  const preview: SerializedPostPreview = {
    uri: post.uri,
    text: record?.text,
    author: serializeNotificationAuthor(post.author),
  };

  if (!embed) return preview;

  // Extract images
  if (embed.$type === 'app.bsky.embed.images#view' && embed.images) {
    preview.images = embed.images.map((img: any) => ({
      thumb: img.thumb,
      fullsize: img.fullsize,
      alt: img.alt || '',
      aspectRatio: img.aspectRatio,
    }));
  } else if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    embed.media?.$type === 'app.bsky.embed.images#view' &&
    embed.media.images
  ) {
    preview.images = embed.media.images.map((img: any) => ({
      thumb: img.thumb,
      fullsize: img.fullsize,
      alt: img.alt || '',
      aspectRatio: img.aspectRatio,
    }));
  }

  // Extract video
  if (embed.$type === 'app.bsky.embed.video#view') {
    preview.video = {
      playlist: embed.playlist,
      thumbnail: embed.thumbnail,
      aspectRatio: embed.aspectRatio,
    };
  } else if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    embed.media?.$type === 'app.bsky.embed.video#view'
  ) {
    preview.video = {
      playlist: embed.media.playlist,
      thumbnail: embed.media.thumbnail,
      aspectRatio: embed.media.aspectRatio,
    };
  }

  // Extract external link
  if (embed.$type === 'app.bsky.embed.external#view' && embed.external) {
    preview.external = {
      uri: embed.external.uri,
      title: embed.external.title || '',
      description: embed.external.description || '',
      thumb: embed.external.thumb,
    };
  } else if (
    embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
    embed.media?.$type === 'app.bsky.embed.external#view' &&
    embed.media.external
  ) {
    preview.external = {
      uri: embed.media.external.uri,
      title: embed.media.external.title || '',
      description: embed.media.external.description || '',
      thumb: embed.media.external.thumb,
    };
  }

  return preview;
}

/**
 * Get the post URI for a notification
 */
function getPostUriForNotification(
  notification: AppBskyNotificationListNotifications.Notification,
): string | undefined {
  if (['like', 'repost', 'like-via-repost', 'repost-via-repost'].includes(notification.reason)) {
    return notification.reasonSubject || undefined;
  }
  if (['reply', 'quote', 'mention'].includes(notification.reason)) {
    return notification.uri;
  }
  return undefined;
}

/**
 * Serialize a single notification
 */
function serializeSingleNotification(
  notification: AppBskyNotificationListNotifications.Notification,
  postMap?: Map<string, AppBskyFeedDefs.PostView>,
): SerializedNotification {
  const serialized: SerializedNotification = {
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

  // Add post preview if we have the post data
  if (postMap) {
    const postUri = getPostUriForNotification(notification);
    if (postUri) {
      const post = postMap.get(postUri);
      if (post) {
        serialized.postPreview = serializePostPreview(post);
      }
    }
  }

  return serialized;
}

/**
 * Serialize processed notifications
 */
function serializeProcessedNotifications(
  processedNotifications: ProcessedNotification[],
  postMap?: Map<string, AppBskyFeedDefs.PostView>,
): SerializedProcessedNotification[] {
  return processedNotifications.map(item => {
    if (item.type === 'aggregated') {
      // Get the target post preview for aggregated notifications
      let postPreview: SerializedPostPreview | undefined;
      if (postMap && item.targetPostUri) {
        const post = postMap.get(item.targetPostUri);
        if (post) {
          postPreview = serializePostPreview(post);
        }
      }

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
        notifications: item.notifications.map(n => serializeSingleNotification(n, postMap)),
        targetPostUri: item.targetPostUri,
        postPreview,
      } as SerializedAggregatedNotification;
    } else {
      return {
        type: 'single',
        notification: serializeSingleNotification(item.notification, postMap),
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
  const { isOnline = true, postMap } = options;

  const serializedJSON = useMemo(() => {
    if (!processedNotifications || processedNotifications.length === 0) {
      return null;
    }

    const serializedData: SerializedNotificationData = {
      notifications: serializeProcessedNotifications(processedNotifications, postMap),
      metadata: {
        timestamp: Date.now(),
        isOnline,
      },
      cursor,
    };

    return JSON.stringify(serializedData);
  }, [processedNotifications, cursor, isOnline, postMap]);

  return { serializedJSON };
}
