import { formatDistanceToNow } from 'date-fns';
import type { Post } from '@bsky/shared';

/**
 * Extract text content from a post record
 */
export const getPostText = (post: Post): string => {
  if (post.record && typeof post.record === 'object' && 'text' in post.record) {
    return (post.record as { text?: string }).text || '';
  }
  return '';
};

/**
 * Get the creation date of a post
 */
export const getPostDate = (post: Post): string => {
  if (post.record && typeof post.record === 'object' && 'createdAt' in post.record) {
    return (post.record as { createdAt?: string }).createdAt || post.indexedAt;
  }
  return post.indexedAt || new Date().toISOString();
};

/**
 * Format post date as relative time
 */
export const formatPostTime = (post: Post): string => {
  const date = getPostDate(post);
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

/**
 * Check if a post has an external link embed
 */
export const hasExternalEmbed = (post: Post): boolean => {
  return !!(post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.external#view');
};

/**
 * Check if a post has an image embed
 */
export const hasImageEmbed = (post: Post): boolean => {
  return !!(post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.images#view');
};

/**
 * Check if a post has a quoted post embed
 */
export const hasQuoteEmbed = (post: Post): boolean => {
  return !!(post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.record#view');
};

/**
 * Get external embed data
 */
export const getExternalEmbed = (post: Post): { uri: string; title: string; description: string; thumb?: string } | null => {
  if (hasExternalEmbed(post) && post.embed) {
    const external = (post.embed as any).external;
    return external || null;
  }
  return null;
};

/**
 * Get image embed data
 */
export const getImageEmbed = (post: Post): Array<{ thumb: string; fullsize: string; alt: string }> | null => {
  if (hasImageEmbed(post) && post.embed) {
    const images = (post.embed as any).images;
    return images || null;
  }
  return null;
};

/**
 * Get quoted post data
 */
export const getQuoteEmbed = (post: Post): { uri: string; cid: string; value: any; author: any } | null => {
  if (hasQuoteEmbed(post) && post.embed) {
    const record = (post.embed as any).record;
    return record || null;
  }
  return null;
};