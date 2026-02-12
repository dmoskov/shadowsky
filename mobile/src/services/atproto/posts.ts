import {getAtProtoClient} from './client';
import {RichText, AppBskyFeedPost} from '@atproto/api';

export interface CreatePostOptions {
  text: string;
  images?: {
    uri: string;
    alt?: string;
  }[];
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

  // Handle embeds (images, quote, or both)
  const hasImages = options.images && options.images.length > 0;
  const hasQuote = !!options.quote;

  if (hasImages && hasQuote) {
    // Combined quote + images: use recordWithMedia
    const imageBlobs = await Promise.all(
      options.images.map(async (img) => {
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
  } else if (hasImages) {
    // Images only
    const imageBlobs = await Promise.all(
      options.images.map(async (img) => {
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
  }

  // Add languages
  if (options.langs) {
    record.langs = options.langs;
  }

  const response = await agent.post(record);
  return response;
}

/**
 * Delete a post
 */
export async function deletePost(uri: string) {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  await agent.deletePost(uri);
}

/**
 * Like a post
 */
export async function likePost(uri: string, cid: string) {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const response = await agent.like(uri, cid);
  return response;
}

/**
 * Unlike a post
 */
export async function unlikePost(likeUri: string) {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  await agent.deleteLike(likeUri);
}

/**
 * Repost a post
 */
export async function repost(uri: string, cid: string) {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const response = await agent.repost(uri, cid);
  return response;
}

/**
 * Delete a repost
 */
export async function deleteRepost(repostUri: string) {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  await agent.deleteRepost(repostUri);
}

/**
 * Upload an image
 * Note: This is a helper function that needs platform-specific implementation
 */
async function uploadImage(uri: string) {
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
}
