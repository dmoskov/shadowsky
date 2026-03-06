/**
 * Notification Data Serializer
 *
 * Transforms AT Protocol notification data from @atproto/api into a format
 * optimized for Swift consumption via JSON serialization.
 */

import { useMemo } from 'react';
import { AppBskyNotificationListNotifications, AppBskyFeedPost, AppBskyFeedDefs, AppBskyEmbedImages, AppBskyEmbedExternal, AppBskyEmbedVideo, AppBskyEmbedRecordWithMedia } from '@atproto/api';
import { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { ProcessedNotification } from '../../utils/notification-aggregator';

// Types for serialized notifications
interface SerializedNotificationAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
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
  isVerified?: boolean;
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
function serializeNotificationAuthor(author: { did: string; handle: string; displayName?: string; avatar?: string; verification?: { verifiedStatus?: string } }): SerializedNotificationAuthor {
  return {
    did: author.did,
    handle: author.handle,
    displayName: author.displayName,
    avatar: author.avatar,
    isVerified: author.verification?.verifiedStatus === 'valid' || undefined,
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
  const embed = post.embed;
  const record = post.record as AppBskyFeedPost.Record;
  const preview: SerializedPostPreview = {
    uri: post.uri,
    text: record?.text,
    author: serializeNotificationAuthor(post.author),
  };

  if (!embed) return preview;

  // Extract images
  if (embed.$type === 'app.bsky.embed.images#view') {
    const imagesView = embed as AppBskyEmbedImages.View;
    preview.images = imagesView.images.map((img) => ({
      thumb: img.thumb,
      fullsize: img.fullsize,
      alt: img.alt || '',
      aspectRatio: img.aspectRatio,
    }));
  } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const rwmView = embed as AppBskyEmbedRecordWithMedia.View;
    if (rwmView.media?.$type === 'app.bsky.embed.images#view') {
      const mediaImages = rwmView.media as AppBskyEmbedImages.View;
      preview.images = mediaImages.images.map((img) => ({
        thumb: img.thumb,
        fullsize: img.fullsize,
        alt: img.alt || '',
        aspectRatio: img.aspectRatio,
      }));
    }
  }

  // Extract video
  if (embed.$type === 'app.bsky.embed.video#view') {
    const videoView = embed as AppBskyEmbedVideo.View;
    preview.video = {
      playlist: videoView.playlist,
      thumbnail: videoView.thumbnail,
      aspectRatio: videoView.aspectRatio,
    };
  } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const rwmView = embed as AppBskyEmbedRecordWithMedia.View;
    if (rwmView.media?.$type === 'app.bsky.embed.video#view') {
      const mediaVideo = rwmView.media as AppBskyEmbedVideo.View;
      preview.video = {
        playlist: mediaVideo.playlist,
        thumbnail: mediaVideo.thumbnail,
        aspectRatio: mediaVideo.aspectRatio,
      };
    }
  }

  // Extract external link
  if (embed.$type === 'app.bsky.embed.external#view') {
    const externalView = embed as AppBskyEmbedExternal.View;
    preview.external = {
      uri: externalView.external.uri,
      title: externalView.external.title || '',
      description: externalView.external.description || '',
      thumb: externalView.external.thumb,
    };
  } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const rwmView = embed as AppBskyEmbedRecordWithMedia.View;
    if (rwmView.media?.$type === 'app.bsky.embed.external#view') {
      const mediaExternal = rwmView.media as AppBskyEmbedExternal.View;
      preview.external = {
        uri: mediaExternal.external.uri,
        title: mediaExternal.external.title || '',
        description: mediaExternal.external.description || '',
        thumb: mediaExternal.external.thumb,
      };
    }
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
          isVerified: undefined,
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
