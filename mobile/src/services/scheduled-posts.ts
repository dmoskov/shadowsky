/**
 * Scheduled Posts Service
 * Manages queued posts stored in AsyncStorage with AT Proto sync
 * for cross-platform visibility.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAtProtoClient} from './atproto/client';
import {createLogger} from '../utils/logger';

const logger = createLogger('ScheduledPosts');
const SCHEDULED_POSTS_KEY = '@shadowsky/scheduled_posts';
const ATPROTO_COLLECTION = 'com.shadowsky.scheduledPost';

export interface ScheduledPost {
  id: string;
  text: string;
  scheduledTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPostInput {
  text: string;
  scheduledTime: Date;
}

// ---------- AT Proto record types ----------

interface ScheduledPostRecord {
  $type: typeof ATPROTO_COLLECTION;
  id: string;
  scheduledFor: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  text?: string;
  threadPosts?: Array<{text: string}>;
  replyToUri?: string;
  replyToCid?: string;
  quotedPostUri?: string;
  quotedPostCid?: string;
  draftId?: string;
  publishedAt?: string;
  platform?: string;
  [key: string]: unknown;
}

/**
 * Convert a local ScheduledPost to an AT Proto record
 */
function postToRecord(post: ScheduledPost): ScheduledPostRecord {
  return {
    $type: ATPROTO_COLLECTION,
    id: post.id,
    scheduledFor: post.scheduledTime.toISOString(),
    status: 'pending',
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    text: post.text,
    platform: 'ios',
  };
}

/**
 * Convert an AT Proto record to a local ScheduledPost
 */
function recordToPost(record: ScheduledPostRecord): ScheduledPost {
  return {
    id: record.id,
    text: record.text || record.threadPosts?.map(tp => tp.text).join('\n\n') || '',
    scheduledTime: new Date(record.scheduledFor),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * Generate a stable record key from a scheduled post ID
 */
function getRecordKey(postId: string): string {
  return postId.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ---------- AT Proto sync helpers ----------

/**
 * Get the AT Proto agent if available (authenticated)
 */
function getAgentSafe() {
  try {
    const client = getAtProtoClient();
    if (!client.isAuthenticated()) return null;
    return client.getAgent();
  } catch {
    return null;
  }
}

/**
 * Fetch all scheduled posts from AT Proto
 */
async function fetchFromAtProto(): Promise<ScheduledPost[]> {
  const agent = getAgentSafe();
  if (!agent || !agent.session?.did) return [];

  try {
    const posts: ScheduledPost[] = [];
    let cursor: string | undefined;

    do {
      const response = await agent.api.com.atproto.repo.listRecords({
        repo: agent.session.did,
        collection: ATPROTO_COLLECTION,
        limit: 100,
        cursor,
      });

      for (const rec of response.data.records) {
        const record = rec.value as ScheduledPostRecord;
        posts.push(recordToPost(record));
      }

      cursor = response.data.cursor;
    } while (cursor);

    return posts;
  } catch (error) {
    logger.error('Failed to fetch scheduled posts from AT Proto:', error);
    return [];
  }
}

/**
 * Push a scheduled post to AT Proto
 */
async function pushToAtProto(post: ScheduledPost): Promise<void> {
  const agent = getAgentSafe();
  if (!agent || !agent.session?.did) return;

  try {
    const record = postToRecord(post);
    const rkey = getRecordKey(post.id);

    await agent.api.com.atproto.repo.putRecord({
      repo: agent.session.did,
      collection: ATPROTO_COLLECTION,
      rkey,
      record,
    });
  } catch (error) {
    logger.error(`Failed to push scheduled post ${post.id} to AT Proto:`, error);
    throw error;
  }
}

/**
 * Remove a scheduled post from AT Proto
 */
async function removeFromAtProto(postId: string): Promise<void> {
  const agent = getAgentSafe();
  if (!agent || !agent.session?.did) return;

  try {
    const rkey = getRecordKey(postId);

    await agent.api.com.atproto.repo.deleteRecord({
      repo: agent.session.did,
      collection: ATPROTO_COLLECTION,
      rkey,
    });
  } catch {
    // 404 is fine - record doesn't exist
  }
}

/**
 * Merge local and remote posts. Remote posts not in local are added.
 * Posts in both locations use the one with a newer updatedAt.
 */
function mergePosts(
  localPosts: ScheduledPost[],
  remotePosts: ScheduledPost[],
): ScheduledPost[] {
  const localMap = new Map(localPosts.map(p => [p.id, p]));
  const merged: ScheduledPost[] = [];

  // Process remote posts
  for (const remotePost of remotePosts) {
    const localPost = localMap.get(remotePost.id);
    if (!localPost) {
      // New from remote (from web or another device)
      merged.push(remotePost);
    } else {
      // Both exist - use newer
      if (remotePost.updatedAt.getTime() > localPost.updatedAt.getTime()) {
        merged.push(remotePost);
      } else {
        merged.push(localPost);
      }
      localMap.delete(remotePost.id);
    }
  }

  // Add remaining local-only posts
  const remaining = Array.from(localMap.values());
  for (const localPost of remaining) {
    merged.push(localPost);
  }

  return merged;
}

// ---------- Public API ----------

/**
 * Get all scheduled posts (merged from local + AT Proto)
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  try {
    // Load local posts
    const data = await AsyncStorage.getItem(SCHEDULED_POSTS_KEY);
    let localPosts: ScheduledPost[] = [];

    if (data) {
      const parsed = JSON.parse(data) as ScheduledPost[];
      localPosts = parsed.map(post => ({
        ...post,
        scheduledTime: new Date(post.scheduledTime),
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
      }));
    }

    // Fetch remote posts and merge
    const remotePosts = await fetchFromAtProto();
    if (remotePosts.length > 0) {
      const merged = mergePosts(localPosts, remotePosts);

      // Push any local-only posts to AT Proto
      const remoteIds = new Set(remotePosts.map(p => p.id));
      const localOnly = localPosts.filter(p => !remoteIds.has(p.id));
      for (const post of localOnly) {
        pushToAtProto(post).catch(err =>
          logger.error(`Failed to sync local post ${post.id} to AT Proto:`, err),
        );
      }

      // Save merged result back to local
      await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(merged));

      return merged;
    }

    return localPosts;
  } catch (error) {
    logger.error('Failed to load scheduled posts:', error);
    return [];
  }
}

/**
 * Add a new scheduled post
 */
export async function addScheduledPost(
  input: ScheduledPostInput,
): Promise<ScheduledPost> {
  const posts = await getScheduledPosts();

  const newPost: ScheduledPost = {
    id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: input.text,
    scheduledTime: input.scheduledTime,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  posts.push(newPost);
  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(posts));

  // Sync to AT Proto for cross-platform visibility
  pushToAtProto(newPost).catch(err =>
    logger.error(`Failed to sync new scheduled post ${newPost.id} to AT Proto:`, err),
  );

  return newPost;
}

/**
 * Update an existing scheduled post
 */
export async function updateScheduledPost(
  id: string,
  updates: Partial<Pick<ScheduledPost, 'text' | 'scheduledTime'>>,
): Promise<ScheduledPost | null> {
  const posts = await getScheduledPosts();
  const index = posts.findIndex(post => post.id === id);

  if (index === -1) {
    return null;
  }

  const updatedPost = {
    ...posts[index],
    ...updates,
    updatedAt: new Date(),
  };

  posts[index] = updatedPost;
  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(posts));

  // Sync to AT Proto for cross-platform visibility
  pushToAtProto(updatedPost).catch(err =>
    logger.error(`Failed to sync updated scheduled post ${updatedPost.id} to AT Proto:`, err),
  );

  return updatedPost;
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(id: string): Promise<boolean> {
  const posts = await getScheduledPosts();
  const filteredPosts = posts.filter(post => post.id !== id);

  if (filteredPosts.length === posts.length) {
    return false; // Post not found
  }

  await AsyncStorage.setItem(SCHEDULED_POSTS_KEY, JSON.stringify(filteredPosts));

  // Remove from AT Proto
  removeFromAtProto(id).catch(err =>
    logger.error(`Failed to remove scheduled post ${id} from AT Proto:`, err),
  );

  return true;
}

/**
 * Clear all scheduled posts
 */
export async function clearScheduledPosts(): Promise<void> {
  await AsyncStorage.removeItem(SCHEDULED_POSTS_KEY);
}
