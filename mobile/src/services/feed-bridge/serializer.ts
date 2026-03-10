/**
 * Feed Data Serializer
 *
 * Transforms AT Protocol feed data from @atproto/api into a format
 * optimized for Swift consumption via JSON serialization.
 */

import {AppBskyFeedDefs, AppBskyFeedPost, AppBskyActorDefs, AppBskyEmbedImages, AppBskyEmbedExternal, AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo, ComAtprotoLabelDefs} from '@atproto/api';
import {
  SerializedFeedViewPost,
  SerializedPost,
  SerializedAuthor,
  SerializedEmbed,
  SerializedViewer,
  SerializedLabel,
  SerializedReplyRef,
  SerializedReason,
  SerializedFeedData,
  PostUpdate,
  FeedBatchUpdate,
  Facet,
  FacetFeature,
  EmbedImages,
  EmbedExternal,
  EmbedVideo,
} from './types';

/** Union of all embed view types returned by the AT Protocol API */
type EmbedView = NonNullable<AppBskyFeedDefs.PostView['embed']>;

/**
 * Serialize author profile
 */
function serializeAuthor(author: AppBskyActorDefs.ProfileViewBasic): SerializedAuthor {
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
function serializeFacets(facets: AppBskyFeedPost.Record['facets']): Facet[] | undefined {
  if (!facets || facets.length === 0) return undefined;

  return facets
    .filter((facet) => facet?.index && facet?.features)
    .map((facet) => ({
      index: {
        byteStart: facet.index.byteStart,
        byteEnd: facet.index.byteEnd,
      },
      features: facet.features.map((feature): FacetFeature => {
        if (feature.$type === 'app.bsky.richtext.facet#mention') {
          return {
            $type: 'app.bsky.richtext.facet#mention',
            did: (feature as { did: string }).did,
          };
        } else if (feature.$type === 'app.bsky.richtext.facet#link') {
          return {
            $type: 'app.bsky.richtext.facet#link',
            uri: (feature as { uri: string }).uri,
          };
        } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
          return {
            $type: 'app.bsky.richtext.facet#tag',
            tag: (feature as { tag: string }).tag,
          };
        }
        // Unknown feature type — treat as tag with empty value
        return { $type: 'app.bsky.richtext.facet#tag', tag: '' };
      }),
    }));
}

/**
 * Serialize embed data
 */
function serializeEmbed(embed: EmbedView | undefined): SerializedEmbed | undefined {
  if (!embed) return undefined;

  switch (embed.$type) {
    case 'app.bsky.embed.images#view': {
      const imagesView = embed as AppBskyEmbedImages.View;
      if (!imagesView.images) return undefined;
      return {
        $type: 'app.bsky.embed.images#view',
        images: imagesView.images.map((img) => ({
          thumb: img.thumb,
          fullsize: img.fullsize,
          alt: img.alt || '',
          aspectRatio: img.aspectRatio,
        })),
      };
    }

    case 'app.bsky.embed.external#view': {
      const externalView = embed as AppBskyEmbedExternal.View;
      if (!externalView.external) return undefined;
      return {
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: externalView.external.uri,
          title: externalView.external.title || '',
          description: externalView.external.description || '',
          thumb: externalView.external.thumb,
        },
      };
    }

    case 'app.bsky.embed.record#view': {
      const recordView = embed as AppBskyEmbedRecord.View;
      const viewRecord = recordView.record as AppBskyEmbedRecord.ViewRecord;
      if (!viewRecord?.cid || !viewRecord?.author) return undefined;
      return {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: viewRecord.$type || 'app.bsky.embed.record#viewRecord',
          uri: viewRecord.uri,
          cid: viewRecord.cid,
          author: serializeAuthor(viewRecord.author),
          value: {
            text: (viewRecord.value as { text?: string })?.text || '',
            createdAt: (viewRecord.value as { createdAt?: string })?.createdAt || viewRecord.indexedAt,
          },
          embeds: viewRecord.embeds?.map(serializeEmbed).filter((e): e is SerializedEmbed => !!e),
          indexedAt: viewRecord.indexedAt,
        },
      };
    }

    case 'app.bsky.embed.recordWithMedia#view': {
      const rwmView = embed as AppBskyEmbedRecordWithMedia.View;
      const innerRecord = rwmView.record?.record as AppBskyEmbedRecord.ViewRecord;
      if (!innerRecord?.cid || !innerRecord?.author) return undefined;
      return {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          record: {
            $type: innerRecord.$type || 'app.bsky.embed.record#viewRecord',
            uri: innerRecord.uri,
            cid: innerRecord.cid,
            author: serializeAuthor(innerRecord.author),
            value: {
              text: (innerRecord.value as { text?: string })?.text || '',
              createdAt: (innerRecord.value as { createdAt?: string })?.createdAt || innerRecord.indexedAt,
            },
            embeds: innerRecord.embeds?.map(serializeEmbed).filter((e): e is SerializedEmbed => !!e),
            indexedAt: innerRecord.indexedAt,
          },
        },
        media: serializeEmbed(rwmView.media) as EmbedImages | EmbedExternal | EmbedVideo,
      };
    }

    case 'app.bsky.embed.video#view': {
      const videoView = embed as AppBskyEmbedVideo.View;
      // Handle both flat (cid at top level) and nested (cid under .video) structures
      const vid = (videoView as any).video;
      const cid = videoView.cid || vid?.cid;
      const playlist = videoView.playlist || vid?.playlist;
      const thumbnail = videoView.thumbnail || vid?.thumbnail;
      const aspectRatio = videoView.aspectRatio || vid?.aspectRatio;
      if (!cid) return undefined;
      return {
        $type: 'app.bsky.embed.video#view',
        video: {
          cid,
          playlist,
          thumbnail,
          aspectRatio,
        },
      };
    }

    default:
      return undefined;
  }
}

/**
 * Serialize viewer state
 */
function serializeViewer(viewer: AppBskyFeedDefs.ViewerState | undefined): SerializedViewer | undefined {
  if (!viewer) return undefined;

  return {
    like: viewer.like,
    repost: viewer.repost,
  };
}

/**
 * Serialize labels
 */
function serializeLabels(labels: ComAtprotoLabelDefs.Label[] | undefined): SerializedLabel[] | undefined {
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
  const record = post.record as AppBskyFeedPost.Record;

  return {
    uri: post.uri,
    cid: post.cid,
    author: serializeAuthor(post.author),
    record: {
      text: record?.text || '',
      facets: serializeFacets(record?.facets),
      createdAt: record?.createdAt || post.indexedAt || new Date().toISOString(),
    },
    embed: serializeEmbed(post.embed),
    replyCount: post.replyCount ?? 0,
    repostCount: post.repostCount ?? 0,
    likeCount: post.likeCount ?? 0,
    quoteCount: post.quoteCount ?? 0,
    viewer: serializeViewer(post.viewer),
    labels: serializeLabels(post.labels),
    indexedAt: post.indexedAt || new Date().toISOString(),
  };
}

/**
 * Serialize reply reference
 */
function serializeReplyRef(reply: AppBskyFeedDefs.ReplyRef | undefined): SerializedReplyRef | undefined {
  if (!reply) return undefined;
  const parent = reply.parent as AppBskyFeedDefs.PostView;
  const root = reply.root as AppBskyFeedDefs.PostView;
  if (!parent?.author || !root?.author) return undefined;

  return {
    parent: serializePost(parent),
    root: serializePost(root),
  };
}

/**
 * Serialize reason (e.g., repost)
 */
function serializeReason(reason: AppBskyFeedDefs.FeedViewPost['reason']): SerializedReason | undefined {
  if (!reason) return undefined;

  if (AppBskyFeedDefs.isReasonRepost(reason) && reason.by) {
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
  return posts
    .filter(p => p?.post?.uri)
    .map(serializeFeedViewPost);
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
