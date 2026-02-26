import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';
import {AppBskyFeedPost, AppBskyEmbedImages, AppBskyEmbedRecordWithMedia} from '@atproto/api';
import {createLogger} from '../../utils/logger';

const logger = createLogger('PostEditor');

/**
 * Parse an AT URI into its components.
 * Format: at://did/collection/rkey
 */
function parseAtUri(uri: string): {repo: string; collection: string; rkey: string} {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }
  return {repo: match[1], collection: match[2], rkey: match[3]};
}

/**
 * Update alt text on specific images of an existing post.
 * Uses com.atproto.repo.putRecord to replace the post record in-place.
 *
 * @param postUri - The AT URI of the post to update
 * @param altTextUpdates - Map of image index to new alt text
 * @returns The updated post CID
 */
export async function updatePostAltText(
  postUri: string,
  altTextUpdates: Record<number, string>,
): Promise<string> {
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      const {repo, collection, rkey} = parseAtUri(postUri);

      // Fetch the existing record
      const existing = await agent.com.atproto.repo.getRecord({
        repo,
        collection,
        rkey,
      });

      const record = existing.data.value as AppBskyFeedPost.Record;
      if (!record.embed) {
        throw new Error('Post has no embed to update');
      }

      // Update alt text on images in the embed
      let updated = false;

      if (
        record.embed.$type === 'app.bsky.embed.images' &&
        AppBskyEmbedImages.isMain(record.embed)
      ) {
        for (const [indexStr, altText] of Object.entries(altTextUpdates)) {
          const index = parseInt(indexStr, 10);
          if (index >= 0 && index < record.embed.images.length) {
            record.embed.images[index].alt = altText;
            updated = true;
          }
        }
      } else if (
        record.embed.$type === 'app.bsky.embed.recordWithMedia' &&
        AppBskyEmbedRecordWithMedia.isMain(record.embed)
      ) {
        const media = record.embed.media;
        if (
          media.$type === 'app.bsky.embed.images' &&
          AppBskyEmbedImages.isMain(media)
        ) {
          for (const [indexStr, altText] of Object.entries(altTextUpdates)) {
            const index = parseInt(indexStr, 10);
            if (index >= 0 && index < media.images.length) {
              media.images[index].alt = altText;
              updated = true;
            }
          }
        }
      }

      if (!updated) {
        throw new Error('No images were updated. The post may not have image embeds.');
      }

      // Write back using putRecord
      const response = await agent.com.atproto.repo.putRecord({
        repo,
        collection,
        rkey,
        record: record as unknown as Record<string, unknown>,
        swapRecord: existing.data.cid,
      });

      logger.log('Post alt text updated successfully');
      return response.data.cid;
    },
    ATProtoEndpointType.RECORD,
  );
}

/**
 * Fetch the user's own posts that have images without alt text.
 * Used for the batch alt text backfill feature.
 *
 * @param cursor - Pagination cursor
 * @param limit - Number of posts to fetch per page
 * @returns Posts with missing alt text and pagination cursor
 */
export async function fetchPostsWithMissingAltText(
  cursor?: string,
  limit: number = 25,
): Promise<{
  posts: Array<{
    uri: string;
    cid: string;
    text: string;
    images: Array<{thumb: string; fullsize: string; alt: string; index: number}>;
    createdAt: string;
  }>;
  cursor?: string;
}> {
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      const did = agent.session?.did;

      if (!did) {
        throw new Error('Not authenticated');
      }

      const response = await agent.getAuthorFeed({
        actor: did,
        limit,
        cursor,
        filter: 'posts_with_media',
      });

      const postsWithMissingAlt: Array<{
        uri: string;
        cid: string;
        text: string;
        images: Array<{thumb: string; fullsize: string; alt: string; index: number}>;
        createdAt: string;
      }> = [];

      for (const item of response.data.feed) {
        const post = item.post;
        const embed = post.embed;
        if (!embed) continue;

        let images: Array<{thumb: string; fullsize: string; alt: string; index: number}> = [];

        if (AppBskyEmbedImages.isView(embed)) {
          images = embed.images
            .map((img, i) => ({
              thumb: img.thumb,
              fullsize: img.fullsize,
              alt: img.alt || '',
              index: i,
            }))
            .filter(img => !img.alt);
        } else if (AppBskyEmbedRecordWithMedia.isView(embed)) {
          const media = embed.media;
          if (AppBskyEmbedImages.isView(media)) {
            images = media.images
              .map((img, i) => ({
                thumb: img.thumb,
                fullsize: img.fullsize,
                alt: img.alt || '',
                index: i,
              }))
              .filter(img => !img.alt);
          }
        }

        if (images.length > 0) {
          const record = post.record as AppBskyFeedPost.Record;
          postsWithMissingAlt.push({
            uri: post.uri,
            cid: post.cid,
            text: record.text || '',
            images,
            createdAt: record.createdAt || post.indexedAt,
          });
        }
      }

      return {
        posts: postsWithMissingAlt,
        cursor: response.data.cursor,
      };
    },
    ATProtoEndpointType.FEED,
  );
}
