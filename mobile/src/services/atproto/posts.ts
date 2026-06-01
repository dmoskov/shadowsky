import {interactions as coreInteractions} from '@bsky/core';
import {getAtProtoClient} from './client';
import {RichText, AppBskyFeedPost} from '@atproto/api';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

// Singleton agent accessor for the wrappers that delegate to @bsky/core.
const postsAgent = () => getAtProtoClient().getAgent();

export interface CreatePostOptions {
  text: string;
  images?: {
    uri: string;
    alt?: string;
  }[];
  video?: {
    uri: string;
    alt?: string;
  };
  external?: {
    uri: string;
    title: string;
    description: string;
    thumb?: string;
  };
  reply?: {
    root: {uri: string; cid: string};
    parent: {uri: string; cid: string};
  };
  quote?: {uri: string; cid: string};
  langs?: string[];
  selfLabels?: string[];
  threadgateAllow?: 'following' | 'mentioned' | 'nobody';
}

/**
 * Create a new post
 */
export async function createPost(options: CreatePostOptions) {
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      // Process rich text (mentions, links, etc.)
      const rt = new RichText({text: options.text});
      await rt.detectFacets(agent);

      const record: Partial<AppBskyFeedPost.Record> = {
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };

      // Add reply reference if this is a reply
      if (options.reply) {
        record.reply = options.reply;
      }

      // Handle embeds (images, video, external, quote, or combinations)
      const hasImages = options.images && options.images.length > 0;
      const hasVideo = !!options.video;
      const hasExternal = !!options.external;
      const hasQuote = !!options.quote;

      if (hasVideo && hasQuote && options.video && options.quote) {
        // Combined quote + video: use recordWithMedia
        const videoBlob = await uploadVideo(options.video.uri);

        record.embed = {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: options.quote,
          },
          media: {
            $type: 'app.bsky.embed.video',
            video: videoBlob,
            alt: options.video.alt || '',
          },
        };
      } else if (hasImages && hasQuote && options.quote) {
        // Combined quote + images: use recordWithMedia
        const imageBlobs = await Promise.all(
          options.images!.map(async img => {
            const blob = await uploadImage(img.uri);
            return {
              alt: img.alt || '',
              image: blob,
            };
          }),
        );

        record.embed = {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: options.quote,
          },
          media: {
            $type: 'app.bsky.embed.images',
            images: imageBlobs,
          },
        };
      } else if (hasQuote) {
        // Quote only
        record.embed = {
          $type: 'app.bsky.embed.record',
          record: options.quote,
        };
      } else if (hasVideo && options.video) {
        // Video only
        const videoBlob = await uploadVideo(options.video.uri);

        record.embed = {
          $type: 'app.bsky.embed.video',
          video: videoBlob,
          alt: options.video.alt || '',
        };
      } else if (hasImages) {
        // Images only
        const imageBlobs = await Promise.all(
          options.images!.map(async img => {
            const blob = await uploadImage(img.uri);
            return {
              alt: img.alt || '',
              image: blob,
            };
          }),
        );

        record.embed = {
          $type: 'app.bsky.embed.images',
          images: imageBlobs,
        };
      } else if (hasExternal && options.external) {
        // External embed only (e.g., GIFs from Tenor)
        const externalEmbed: any = {
          uri: options.external.uri,
          title: options.external.title,
          description: options.external.description,
        };

        if (options.external.thumb) {
          try {
            const thumbBlob = await uploadImage(options.external.thumb);
            externalEmbed.thumb = thumbBlob;
          } catch {
            // Thumbnail upload failure is non-fatal
          }
        }

        record.embed = {
          $type: 'app.bsky.embed.external',
          external: externalEmbed,
        };
      }

      // Add languages
      if (options.langs) {
        record.langs = options.langs;
      }

      // Add self-labels (content warnings)
      if (options.selfLabels && options.selfLabels.length > 0) {
        record.labels = {
          $type: 'com.atproto.label.defs#selfLabels',
          values: options.selfLabels.map((val) => ({ val })),
        };
      }

      const response = await agent.post(record);

      // Create threadgate if needed
      if (options.threadgateAllow && response.uri) {
        try {
          const allow: any[] = [];
          if (options.threadgateAllow === 'following') {
            allow.push({ $type: 'app.bsky.feed.threadgate#followingRule' });
          } else if (options.threadgateAllow === 'mentioned') {
            allow.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
          }
          // 'nobody' = empty allow list

          const rkey = response.uri.split('/').pop();
          await agent.api.com.atproto.repo.createRecord({
            repo: agent.session?.did || '',
            collection: 'app.bsky.feed.threadgate',
            rkey,
            record: {
              $type: 'app.bsky.feed.threadgate',
              post: response.uri,
              allow,
              createdAt: new Date().toISOString(),
            },
          });
        } catch (e) {
          // Threadgate creation failure is non-fatal
        }
      }

      return response;
    },
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Delete a post
 */
export async function deletePost(uri: string) {
  return rateLimited(
    () => coreInteractions.deletePost(postsAgent(), uri),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Like a post
 */
export async function likePost(uri: string, cid: string) {
  return rateLimited(
    () => coreInteractions.likePost(postsAgent(), uri, cid),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Unlike a post
 */
export async function unlikePost(likeUri: string) {
  return rateLimited(
    () => coreInteractions.unlikePost(postsAgent(), likeUri),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Repost a post
 */
export async function repost(uri: string, cid: string) {
  return rateLimited(
    () => coreInteractions.repost(postsAgent(), uri, cid),
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Delete a repost
 */
export async function deleteRepost(repostUri: string) {
  return rateLimited(
    () => coreInteractions.deleteRepost(postsAgent(), repostUri),
    ATProtoEndpointType.RECORD,
  );
}

export interface CreateThreadOptions {
  posts: {
    text: string;
    images?: {
      uri: string;
      alt?: string;
    }[];
    video?: {
      uri: string;
      alt?: string;
    };
    langs?: string[];
  }[];
  reply?: {
    root: {uri: string; cid: string};
    parent: {uri: string; cid: string};
  };
  langs?: string[];
}

export interface ThreadPostResult {
  uri: string;
  cid: string;
  success: boolean;
  error?: string;
}

export interface CreateThreadResult {
  posts: ThreadPostResult[];
  successCount: number;
  failureCount: number;
}

/**
 * Create a thread of connected posts
 * Each post replies to the previous one, creating a chain
 */
export async function createThread(
  options: CreateThreadOptions
): Promise<CreateThreadResult> {
  const results: ThreadPostResult[] = [];
  let root: {uri: string; cid: string} | null = null;
  let parent: {uri: string; cid: string} | null = null;

  // If this thread is a reply to another post, use that as the root
  if (options.reply) {
    root = options.reply.root;
    parent = options.reply.parent;
  }

  for (let i = 0; i < options.posts.length; i++) {
    const postData = options.posts[i];

    try {
      const postOptions: CreatePostOptions = {
        text: postData.text,
        images: postData.images,
        video: postData.video,
        langs: postData.langs || options.langs,
      };

      // Add reply reference if this is not the first post, or if replying to another post
      if (parent && root) {
        postOptions.reply = {
          root: root,
          parent: parent,
        };
      }

      const response = await createPost(postOptions);

      // Store the result
      results.push({
        uri: response.uri,
        cid: response.cid,
        success: true,
      });

      // Set up for next post in thread
      if (i === 0 && !root) {
        // First post becomes the root
        root = {uri: response.uri, cid: response.cid};
      }
      // Each post becomes the parent for the next one
      parent = {uri: response.uri, cid: response.cid};
    } catch (error) {
      // Record failure but continue trying to post remaining posts
      results.push({
        uri: '',
        cid: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Stop thread creation on failure to maintain chain integrity
      break;
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return {
    posts: results,
    successCount,
    failureCount,
  };
}

/**
 * Get users who liked a post
 */
export async function getLikes(uri: string, cursor?: string) {
  return rateLimited(
    () => coreInteractions.getLikes(postsAgent(), uri, cursor),
    ATProtoEndpointType.FEED,
  );
}

/**
 * Get users who reposted a post
 */
export async function getRepostsByPost(uri: string, cursor?: string) {
  return rateLimited(
    () => coreInteractions.getRepostedBy(postsAgent(), uri, cursor),
    ATProtoEndpointType.FEED,
  );
}

/**
 * Get posts that quote a post
 */
export async function getQuotesByPost(uri: string, cursor?: string) {
  return rateLimited(
    () => coreInteractions.getQuotes(postsAgent(), uri, cursor),
    ATProtoEndpointType.FEED,
  );
}

/**
 * Upload an image
 * Note: This is a helper function that needs platform-specific implementation
 */
async function uploadImage(uri: string) {
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      // For React Native, we need to fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to Uint8Array for upload
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const uploadResponse = await agent.uploadBlob(uint8Array, {
        encoding: blob.type,
      });

      return uploadResponse.data.blob;
    },
    ATProtoEndpointType.UPLOAD,
  );
}

/**
 * Upload a video
 * Note: Video uploads use the same blob upload mechanism as images
 */
async function uploadVideo(uri: string) {
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      // For React Native, we need to fetch the video as a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to Uint8Array for upload
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload video blob with appropriate MIME type
      const uploadResponse = await agent.uploadBlob(uint8Array, {
        encoding: blob.type || 'video/mp4',
      });

      return uploadResponse.data.blob;
    },
    ATProtoEndpointType.UPLOAD,
  );
}
