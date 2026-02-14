/**
 * Feed Data Serializer
 *
 * Transforms AT Protocol feed data from @atproto/api into a format
 * optimized for Swift consumption via JSON serialization.
 */

import {AppBskyFeedDefs, AppBskyActorDefs} from '@atproto/api';
import {
  SerializedFeedViewPost,
  SerializedPost,
  SerializedAuthor,
  SerializedRecord,
  SerializedEmbed,
  SerializedViewer,
  SerializedLabel,
  SerializedReplyRef,
  SerializedReason,
  SerializedFeedData,
  FeedUpdateMetadata,
  PostUpdate,
  FeedBatchUpdate,
  Facet,
} from './types';

/**
 * Serialize author profile
 */
function serializeAuthor(author: AppBskyActorDefs.ProfileViewBasic): SerializedAuthor {
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
function serializeFacets(facets: unknown[] | undefined): Facet[] | undefined {
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
 * Serialize embed data
 */
function serializeEmbed(embed: any): SerializedEmbed | undefined {
  if (!embed) return undefined;

  switch (embed.$type) {
    case 'app.bsky.embed.images#view':
      return {
        $type: 'app.bsky.embed.images#view',
        images: embed.images.map((img: any) => ({
          thumb: img.thumb,
          fullsize: img.fullsize,
          alt: img.alt || '',
          aspectRatio: img.aspectRatio,
        })),
      };

    case 'app.bsky.embed.external#view':
      return {
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: embed.external.uri,
          title: embed.external.title,
          description: embed.external.description,
          thumb: embed.external.thumb,
        },
      };

    case 'app.bsky.embed.record#view':
      return {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: embed.record.$type || 'app.bsky.embed.record#viewRecord',
          uri: embed.record.uri,
          cid: embed.record.cid,
          author: serializeAuthor(embed.record.author),
          value: {
            text: embed.record.value?.text || '',
            createdAt: embed.record.value?.createdAt || embed.record.indexedAt,
          },
          embeds: embed.record.embeds?.map(serializeEmbed).filter(Boolean),
          indexedAt: embed.record.indexedAt,
        },
      };

    case 'app.bsky.embed.recordWithMedia#view':
      return {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          record: {
            $type: embed.record.record.$type || 'app.bsky.embed.record#viewRecord',
            uri: embed.record.record.uri,
            cid: embed.record.record.cid,
            author: serializeAuthor(embed.record.record.author),
            value: {
              text: embed.record.record.value?.text || '',
              createdAt: embed.record.record.value?.createdAt || embed.record.record.indexedAt,
            },
            embeds: embed.record.record.embeds?.map(serializeEmbed).filter(Boolean),
            indexedAt: embed.record.record.indexedAt,
          },
        },
        media: serializeEmbed(embed.media) as any,
      };

    case 'app.bsky.embed.video#view':
      return {
        $type: 'app.bsky.embed.video#view',
        video: {
          cid: embed.video.cid,
          playlist: embed.video.playlist,
          thumbnail: embed.video.thumbnail,
          aspectRatio: embed.video.aspectRatio,
        },
      };

    default:
      return undefined;
  }
}

/**
 * Serialize viewer state
 */
function serializeViewer(viewer: any): SerializedViewer | undefined {
  if (!viewer) return undefined;

  return {
    like: viewer.like,
    repost: viewer.repost,
    muted: viewer.muted,
    blocked: viewer.blocked,
  };
}

/**
 * Serialize labels
 */
function serializeLabels(labels: any[] | undefined): SerializedLabel[] | undefined {
  if (!labels || labels.length === 0) return undefined;

  return labels.map(label => ({
    val: label.val,
    src: label.src,
    uri: label.uri,
    cid: label.cid,
    cts: label.cts,
  }));
}

/**
 * Serialize post data
 */
function serializePost(post: AppBskyFeedDefs.PostView): SerializedPost {
  const record = post.record as any;

  return {
    uri: post.uri,
    cid: post.cid,
    author: serializeAuthor(post.author),
    record: {
      text: record?.text || '',
      facets: serializeFacets(record?.facets),
      createdAt: record?.createdAt || post.indexedAt,
      embed: record?.embed,
    },
    embed: serializeEmbed(post.embed),
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    likeCount: post.likeCount,
    quoteCount: post.quoteCount,
    viewer: serializeViewer(post.viewer),
    labels: serializeLabels(post.labels),
    indexedAt: post.indexedAt,
  };
}

/**
 * Serialize reply reference
 */
function serializeReplyRef(reply: any): SerializedReplyRef | undefined {
  if (!reply) return undefined;

  return {
    parent: serializePost(reply.parent),
    root: serializePost(reply.root),
  };
}

/**
 * Serialize reason (e.g., repost)
 */
function serializeReason(reason: any): SerializedReason | undefined {
  if (!reason) return undefined;

  if (reason.$type === 'app.bsky.feed.defs#reasonRepost') {
    return {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: serializeAuthor(reason.by),
      indexedAt: reason.indexedAt,
    };
  }

  return undefined;
}

/**
 * Serialize a single feed view post
 */
export function serializeFeedViewPost(
  feedViewPost: AppBskyFeedDefs.FeedViewPost
): SerializedFeedViewPost {
  return {
    post: serializePost(feedViewPost.post),
    reply: serializeReplyRef(feedViewPost.reply),
    reason: serializeReason(feedViewPost.reason),
    feedContext: feedViewPost.feedContext,
  };
}

/**
 * Serialize an array of feed view posts
 */
export function serializeFeedPosts(
  posts: AppBskyFeedDefs.FeedViewPost[]
): SerializedFeedViewPost[] {
  return posts.map(serializeFeedViewPost);
}

/**
 * Serialize complete feed data with metadata
 */
export function serializeFeedData(
  posts: AppBskyFeedDefs.FeedViewPost[],
  metadata: FeedUpdateMetadata,
  cursor?: string
): SerializedFeedData {
  return {
    posts: serializeFeedPosts(posts),
    metadata,
    cursor,
  };
}

/**
 * Create a post update for incremental changes
 */
export function createPostUpdate(
  uri: string,
  updates: Partial<PostUpdate>
): PostUpdate {
  return {
    uri,
    ...updates,
  };
}

/**
 * Create a batch update for multiple posts
 */
export function createBatchUpdate(updates: PostUpdate[]): FeedBatchUpdate {
  return {
    updates,
    timestamp: Date.now(),
  };
}

/**
 * Serialize to JSON string for passing to Swift
 */
export function serializeToJSON(data: SerializedFeedData | FeedBatchUpdate): string {
  return JSON.stringify(data);
}

/**
 * Extract all posts from paginated React Query data
 */
export function extractPostsFromPages(
  pages: Array<{feed: AppBskyFeedDefs.FeedViewPost[]}> | undefined
): AppBskyFeedDefs.FeedViewPost[] {
  if (!pages) return [];
  return pages.flatMap(page => page.feed || []);
}
