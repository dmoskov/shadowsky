/**
 * TypeScript types for AT Protocol feed data serialization
 * These types match the @atproto/api FeedViewPost structure
 * and are designed for efficient serialization to Swift
 */

/**
 * Rich text facet types
 */
export interface FacetFeatureMention {
  $type: 'app.bsky.richtext.facet#mention';
  did: string;
}

export interface FacetFeatureLink {
  $type: 'app.bsky.richtext.facet#link';
  uri: string;
}

export interface FacetFeatureTag {
  $type: 'app.bsky.richtext.facet#tag';
  tag: string;
}

export type FacetFeature = FacetFeatureMention | FacetFeatureLink | FacetFeatureTag;

export interface FacetIndex {
  byteStart: number;
  byteEnd: number;
}

export interface Facet {
  index: FacetIndex;
  features: FacetFeature[];
}

/**
 * Embed types
 */
export interface ViewImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

export interface EmbedImages {
  $type: 'app.bsky.embed.images#view';
  images: ViewImage[];
}

export interface ViewExternal {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

export interface EmbedExternal {
  $type: 'app.bsky.embed.external#view';
  external: ViewExternal;
}

export interface ViewRecord {
  $type: string;
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  value: {
    text: string;
    createdAt: string;
  };
  embeds?: SerializedEmbed[];
  indexedAt: string;
}

export interface EmbedRecord {
  $type: 'app.bsky.embed.record#view';
  record: ViewRecord;
}

export interface EmbedRecordWithMedia {
  $type: 'app.bsky.embed.recordWithMedia#view';
  record: {
    record: ViewRecord;
  };
  media: EmbedImages | EmbedExternal | EmbedVideo;
}

export interface ViewVideo {
  cid: string;
  playlist: string;
  thumbnail?: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

export interface EmbedVideo {
  $type: 'app.bsky.embed.video#view';
  video: ViewVideo;
}

export type SerializedEmbed =
  | EmbedImages
  | EmbedExternal
  | EmbedRecord
  | EmbedRecordWithMedia
  | EmbedVideo;

/**
 * Author profile
 */
export interface SerializedAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
}

/**
 * Post record
 */
export interface SerializedRecord {
  text: string;
  facets?: Facet[];
  createdAt: string;
  /**
   * Non-lexicon edit stamp (`updatedAt` on the post record). Carried across the
   * bridge so the native feed can show an "Edited" indicator; absent on posts
   * that have never been edited.
   */
  updatedAt?: string;
  embed?: unknown; // Raw embed data from record
}

/**
 * Viewer state (user's interactions with the post)
 */
export interface SerializedViewer {
  like?: string; // AT URI of like record
  repost?: string; // AT URI of repost record
  muted?: boolean;
  blocked?: boolean;
}

/**
 * Label
 */
export interface SerializedLabel {
  val: string;
  src: string;
  uri: string;
  cid?: string;
  cts: string;
}

/**
 * Post data
 */
export interface SerializedPost {
  uri: string;
  cid: string;
  author: SerializedAuthor;
  record: SerializedRecord;
  embed?: SerializedEmbed;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  viewer?: SerializedViewer;
  labels?: SerializedLabel[];
  indexedAt: string;
}

/**
 * Reply reference (parent/root posts)
 */
export interface SerializedReplyRef {
  parent: SerializedPost;
  root: SerializedPost;
}

/**
 * Repost reason
 */
export interface SerializedReasonRepost {
  $type: 'app.bsky.feed.defs#reasonRepost';
  by: SerializedAuthor;
  indexedAt: string;
}

export type SerializedReason = SerializedReasonRepost;

/**
 * Feed view post (top-level feed item)
 */
export interface SerializedFeedViewPost {
  post: SerializedPost;
  reply?: SerializedReplyRef;
  reason?: SerializedReason;
  feedContext?: string;
}

/**
 * Metadata for incremental updates
 */
export interface FeedUpdateMetadata {
  timestamp: number;
  isBookmarked?: boolean;
  isOnline: boolean;
  isFromCache?: boolean;
}

/**
 * Complete feed data package for Swift
 */
export interface SerializedFeedData {
  posts: SerializedFeedViewPost[];
  metadata: FeedUpdateMetadata;
  cursor?: string;
}

/**
 * Incremental update for a single post
 */
export interface PostUpdate {
  uri: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  viewer?: SerializedViewer;
  isBookmarked?: boolean;
}

/**
 * Batch update for efficient incremental changes
 */
export interface FeedBatchUpdate {
  updates: PostUpdate[];
  timestamp: number;
}
