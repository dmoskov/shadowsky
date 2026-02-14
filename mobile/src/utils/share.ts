import { Share, Alert } from 'react-native';
import { AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api';


import { createLogger } from '../utils/logger';

const logger = createLogger('Share');
/**
 * Extract rkey from AT Protocol post URI
 * Post URI format: at://did:plc:xxx/app.bsky.feed.post/rkey123
 */
function extractRkeyFromUri(uri: string): string | null {
  try {
    const parts = uri.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Construct bsky.app URL from post data
 * Format: https://bsky.app/profile/{handle}/post/{rkey}
 */
function constructBskyUrl(handle: string, rkey: string): string {
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

/**
 * Share a post using the system share sheet
 * @param post - The post to share
 * @returns Promise that resolves when share is complete or cancelled
 */
export async function sharePost(post: AppBskyFeedDefs.FeedViewPost): Promise<void> {
  try {
    const postView = post.post;
    const author = postView.author;
    const record = AppBskyFeedPost.isRecord(postView.record) ? postView.record : undefined;

    // Extract rkey from post URI
    const rkey = extractRkeyFromUri(postView.uri);

    if (!rkey) {
      Alert.alert('Error', 'Unable to share this post');
      return;
    }

    // Construct bsky.app URL
    const bskyUrl = constructBskyUrl(author.handle, rkey);

    // Get post text (if available)
    const postText = record?.text || '';

    // Create share message
    const shareMessage = postText
      ? `${postText}\n\n${bskyUrl}`
      : bskyUrl;

    // Share using native share sheet
    await Share.share({
      message: shareMessage,
      url: bskyUrl, // iOS will use this for share sheet
    });
  } catch (error) {
    // User cancelled share or an error occurred
    if (error instanceof Error && error.message !== 'User did not share') {
      logger.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post');
    }
  }
}
