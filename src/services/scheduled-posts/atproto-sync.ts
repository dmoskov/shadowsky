/**
 * AT Protocol Sync for Scheduled Posts
 *
 * Syncs scheduled post data to/from a com.shadowsky.scheduledPost AT Proto collection
 * for cross-platform visibility. Both web and mobile write to this collection so that
 * schedules created on one platform are visible on the other.
 *
 * Note: The executor still runs locally on whatever device created the post.
 * This collection is purely for schedule visibility.
 */

import { AtpAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { withAtProtoRetry } from "../../utils/storage-retry";
import { ScheduledPost } from "./types";

const COLLECTION = "com.shadowsky.scheduledPost";

/**
 * AT Proto record shape for a scheduled post.
 * Excludes media blobs (too large for AT Proto records) - we only store
 * the text/metadata needed for cross-platform schedule visibility.
 */
interface ScheduledPostRecord {
  $type: typeof COLLECTION;
  id: string;
  scheduledFor: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  text?: string;
  threadPosts?: Array<{ text: string }>;
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
 * Convert a ScheduledPost to an AT Proto record.
 * Strips media (too large) and flattens nested objects.
 */
function postToRecord(
  post: ScheduledPost,
  platform: string,
): ScheduledPostRecord {
  const record: ScheduledPostRecord = {
    $type: COLLECTION,
    id: post.id,
    scheduledFor: post.scheduledFor,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    platform,
  };

  if (post.text) record.text = post.text;
  if (post.threadPosts) {
    record.threadPosts = post.threadPosts.map((tp) => ({ text: tp.text }));
  }
  if (post.replyTo) {
    record.replyToUri = post.replyTo.uri;
    record.replyToCid = post.replyTo.cid;
  }
  if (post.quotedPost) {
    record.quotedPostUri = post.quotedPost.uri;
    record.quotedPostCid = post.quotedPost.cid;
  }
  if (post.draftId) record.draftId = post.draftId;
  if (post.publishedAt) record.publishedAt = post.publishedAt;

  return record;
}

/**
 * Convert an AT Proto record back to a partial ScheduledPost.
 * The returned object has all the metadata needed for cross-platform visibility
 * but no media (that stays local).
 */
function recordToPost(record: ScheduledPostRecord): ScheduledPost {
  const post: ScheduledPost = {
    id: record.id,
    userDid: "", // Filled by caller
    scheduledFor: record.scheduledFor,
    status: record.status as ScheduledPost["status"],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    retryCount: 0,
    maxRetries: 3,
  };

  if (record.text) post.text = record.text;
  if (record.threadPosts) {
    post.threadPosts = record.threadPosts.map((tp) => ({ text: tp.text }));
  }
  if (record.replyToUri && record.replyToCid) {
    post.replyTo = { uri: record.replyToUri, cid: record.replyToCid };
  }
  if (record.quotedPostUri && record.quotedPostCid) {
    post.quotedPost = {
      uri: record.quotedPostUri,
      cid: record.quotedPostCid,
    };
  }
  if (record.draftId) post.draftId = record.draftId;
  if (record.publishedAt) post.publishedAt = record.publishedAt;

  return post;
}

/**
 * Generate a stable record key from a scheduled post ID.
 * AT Proto rkeys must be valid TID or path-safe strings.
 */
function getRecordKey(postId: string): string {
  return postId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * ScheduledPostAtProtoSync - handles syncing scheduled posts to AT Proto
 */
export class ScheduledPostAtProtoSync {
  private agent: AtpAgent | null = null;
  private platform: string;

  constructor(platform: string = "web") {
    this.platform = platform;
  }

  /**
   * Initialize with an authenticated agent
   */
  initialize(agent: AtpAgent): void {
    this.agent = agent;
  }

  /**
   * Check if sync is available (agent is set and has a session)
   */
  isAvailable(): boolean {
    return !!(this.agent && this.agent.session?.did);
  }

  private ensureAgent(): { agent: AtpAgent; did: string } {
    if (!this.agent || !this.agent.session?.did) {
      throw new Error("AT Proto agent not available for scheduled post sync");
    }
    return { agent: this.agent, did: this.agent.session.did };
  }

  /**
   * Fetch all scheduled posts from AT Proto.
   * Returns posts from all platforms (web + mobile).
   */
  async fetchAll(): Promise<ScheduledPost[]> {
    const { agent, did } = this.ensureAgent();

    try {
      const posts: ScheduledPost[] = [];
      let cursor: string | undefined;

      do {
        const response = await withAtProtoRetry(async () => {
          return agent.api.com.atproto.repo.listRecords({
            repo: did,
            collection: COLLECTION,
            limit: 100,
            cursor,
          });
        }, "fetch-scheduled-posts");

        for (const rec of response.data.records) {
          const record = rec.value as ScheduledPostRecord;
          const post = recordToPost(record);
          post.userDid = did;
          posts.push(post);
        }

        cursor = response.data.cursor;
      } while (cursor);

      debug.log(`Fetched ${posts.length} scheduled posts from AT Proto`);
      return posts;
    } catch (error) {
      debug.error("Failed to fetch scheduled posts from AT Proto:", error);
      return [];
    }
  }

  /**
   * Push a scheduled post to AT Proto (create or update).
   */
  async upsert(post: ScheduledPost): Promise<void> {
    const { agent, did } = this.ensureAgent();
    const record = postToRecord(post, this.platform);
    const rkey = getRecordKey(post.id);

    try {
      await withAtProtoRetry(async () => {
        await agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection: COLLECTION,
          rkey,
          record,
        });
      }, "upsert-scheduled-post");
    } catch (error) {
      debug.error(
        `Failed to sync scheduled post ${post.id} to AT Proto:`,
        error,
      );
    }
  }

  /**
   * Remove a scheduled post from AT Proto.
   */
  async remove(postId: string): Promise<void> {
    const { agent, did } = this.ensureAgent();
    const rkey = getRecordKey(postId);

    try {
      await withAtProtoRetry(async () => {
        await agent.api.com.atproto.repo.deleteRecord({
          repo: did,
          collection: COLLECTION,
          rkey,
        });
      }, "delete-scheduled-post");
    } catch (error) {
      // 404 is fine - record doesn't exist
      const err = error as { status?: number };
      if (err.status !== 404) {
        debug.error(
          `Failed to delete scheduled post ${postId} from AT Proto:`,
          error,
        );
      }
    }
  }

  /**
   * Merge remote AT Proto posts with local posts.
   *
   * Strategy:
   * - Remote posts not in local → add to local (from other platform)
   * - Posts in both → use the one with newer updatedAt
   * - Local-only posts → keep (will be pushed to AT Proto separately)
   *
   * Returns the merged list and a set of new remote post IDs.
   */
  mergeWithLocal(
    localPosts: ScheduledPost[],
    remotePosts: ScheduledPost[],
  ): { merged: ScheduledPost[]; newFromRemote: string[] } {
    const localMap = new Map(localPosts.map((p) => [p.id, p]));
    const remoteMap = new Map(remotePosts.map((p) => [p.id, p]));
    const merged: ScheduledPost[] = [];
    const newFromRemote: string[] = [];

    // Process all remote posts
    for (const [id, remotePost] of remoteMap) {
      const localPost = localMap.get(id);
      if (!localPost) {
        // New post from another platform
        merged.push(remotePost);
        newFromRemote.push(id);
      } else {
        // Both exist - use newer
        const localTime = new Date(localPost.updatedAt).getTime();
        const remoteTime = new Date(remotePost.updatedAt).getTime();
        if (remoteTime > localTime) {
          // Remote is newer - merge, but keep local media/retry state
          merged.push({
            ...remotePost,
            media: localPost.media,
            threadPosts: localPost.threadPosts?.length
              ? localPost.threadPosts
              : remotePost.threadPosts,
            retryCount: localPost.retryCount,
            maxRetries: localPost.maxRetries,
            lastError: localPost.lastError,
            lastAttemptAt: localPost.lastAttemptAt,
            serverTimeOffset: localPost.serverTimeOffset,
          });
        } else {
          merged.push(localPost);
        }
        localMap.delete(id);
      }
    }

    // Add remaining local-only posts
    for (const localPost of localMap.values()) {
      merged.push(localPost);
    }

    return { merged, newFromRemote };
  }

  /**
   * Full sync: fetch from AT Proto, merge with local, push local-only back.
   * Returns the merged post list.
   */
  async sync(localPosts: ScheduledPost[]): Promise<ScheduledPost[]> {
    if (!this.isAvailable()) {
      return localPosts;
    }

    try {
      const remotePosts = await this.fetchAll();
      const { merged, newFromRemote } = this.mergeWithLocal(
        localPosts,
        remotePosts,
      );

      // Push local-only posts to AT Proto (those not in remote)
      const remoteIds = new Set(remotePosts.map((p) => p.id));
      const localOnly = localPosts.filter((p) => !remoteIds.has(p.id));
      for (const post of localOnly) {
        await this.upsert(post);
      }

      debug.log(
        `AT Proto sync complete: ${newFromRemote.length} new from remote, ${localOnly.length} pushed to remote`,
      );

      return merged;
    } catch (error) {
      debug.error("AT Proto sync failed, using local posts:", error);
      return localPosts;
    }
  }
}
