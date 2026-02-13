import {getAtProtoClient} from './client';
import {RichText, AppBskyFeedPost} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

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
  };
  reply?: {
    root: {uri: string; cid: string};
    parent: {uri: string; cid: string};
  };
  quote?: {uri: string; cid: string};
  langs?: string[];
}

/**
 * Create a new post
 */
export async function createPost(options: CreatePostOptions) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
        options.images!.map(async (img) => {
          const blob = await uploadImage(img.uri);
          return {
            alt: img.alt || '',
            image: blob,
          };
        })
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
        options.images!.map(async (img) => {
          const blob = await uploadImage(img.uri);
          return {
            alt: img.alt || '',
            image: blob,
          };
        })
      );

      record.embed = {
        $type: 'app.bsky.embed.images',
        images: imageBlobs,
      };
    } else if (hasExternal && options.external) {
      // External embed only (e.g., GIFs from Tenor)
      record.embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: options.external.uri,
          title: options.external.title,
          description: options.external.description,
        },
      };
    }

    // Add languages
    if (options.langs) {
      record.langs = options.langs;
    }

    const response = await agent.post(record);
    return response;
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Delete a post
 */
export async function deletePost(uri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.deletePost(uri);
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Like a post
 */
export async function likePost(uri: string, cid: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.like(uri, cid);
        return response;
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Unlike a post
 */
export async function unlikePost(likeUri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.deleteLike(likeUri);
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Repost a post
 */
export async function repost(uri: string, cid: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.repost(uri, cid);
        return response;
      }),
    ATProtoEndpointType.RECORD
  );
}

/**
 * Delete a repost
 */
export async function deleteRepost(repostUri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.deleteRepost(repostUri);
      }),
    ATProtoEndpointType.RECORD
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
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getLikes({
          uri,
          limit: 50,
          cursor,
        });

        return {
          likes: response.data.likes,
          cursor: response.data.cursor,
        };
      }),
    ATProtoEndpointType.READ
  );
}

/**
 * Get users who reposted a post
 */
export async function getRepostsByPost(uri: string, cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getRepostedBy({
          uri,
          limit: 50,
          cursor,
        });

        return {
          repostedBy: response.data.repostedBy,
          cursor: response.data.cursor,
        };
      }),
    ATProtoEndpointType.READ
  );
}

/**
 * Get posts that quote a post
 */
export async function getQuotesByPost(uri: string, cursor?: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.feed.getQuotes({
          uri,
          limit: 50,
          cursor,
        });

        return {
          posts: response.data.posts,
          cursor: response.data.cursor,
        };
      }),
    ATProtoEndpointType.READ
  );
}

/**
 * Upload an image
 * Note: This is a helper function that needs platform-specific implementation
 */
async function uploadImage(uri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.UPLOAD
  );
}

/**
 * Upload a video
 * Note: Video uploads use the same blob upload mechanism as images
 */
async function uploadVideo(uri: string) {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.UPLOAD
  );
}
