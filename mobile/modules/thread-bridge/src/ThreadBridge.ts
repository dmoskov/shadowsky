/**
 * ThreadBridge
 *
 * Serializes thread data (posts with nested replies) from JavaScript to native Swift.
 * Similar to FeedBridge but handles hierarchical thread structures.
 */

import { AppBskyFeedDefs } from '@atproto/api';
import { requireNativeModule } from 'expo-modules-core';

const ThreadBridgeModule = requireNativeModule('ThreadBridge');

// MARK: - Serialized Types

export interface SerializedThreadNode {
  post: SerializedThreadPost;
  parent?: {
    uri: string;
    cid: string;
  };
  replies: SerializedThreadNode[];
}

export interface SerializedThreadPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    facets?: any[];
  };
  indexedAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewer?: {
    like?: string;
    repost?: string;
  };
  labels?: Array<{
    val: string;
    src: string;
  }>;
}

// MARK: - ThreadBridge Class

export class ThreadBridge {
  /**
   * Update the thread data in native Swift
   */
  static setThreadData(thread: AppBskyFeedDefs.ThreadViewPost | null): void {
    if (!thread) {
      ThreadBridgeModule.clearThreadData();
      return;
    }

    const serialized = this.serializeThreadNode(thread);
    ThreadBridgeModule.setThreadData(serialized);
  }

  /**
   * Clear thread data
   */
  static clearThreadData(): void {
    ThreadBridgeModule.clearThreadData();
  }

  /**
   * Send incremental update for a single post (like/repost change)
   */
  static updatePost(uri: string, updates: {
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
    viewer?: {
      like?: string;
      repost?: string;
    };
  }): void {
    ThreadBridgeModule.updatePost({
      uri,
      ...updates,
    });
  }

  /**
   * Serialize a thread node recursively
   */
  private static serializeThreadNode(
    node: AppBskyFeedDefs.ThreadViewPost
  ): SerializedThreadNode {
    const post = node.post;
    const record = post.record as any;

    // Serialize the post
    const serializedPost: SerializedThreadPost = {
      uri: post.uri,
      cid: post.cid,
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
      },
      record: {
        text: record?.text || '',
        createdAt: record?.createdAt || post.indexedAt,
        facets: record?.facets,
      },
      indexedAt: post.indexedAt,
      likeCount: post.likeCount,
      repostCount: post.repostCount,
      replyCount: post.replyCount,
      quoteCount: post.quoteCount,
      viewer: post.viewer
        ? {
            like: post.viewer.like,
            repost: post.viewer.repost,
          }
        : undefined,
      labels: post.labels?.map((label) => ({
        val: label.val,
        src: label.src,
      })),
    };

    // Serialize parent reference
    const parent = node.parent
      ? {
          uri: (node.parent as any).uri,
          cid: (node.parent as any).cid,
        }
      : undefined;

    // Serialize replies recursively
    const replies: SerializedThreadNode[] = [];
    if (node.replies && Array.isArray(node.replies)) {
      for (const reply of node.replies) {
        if (AppBskyFeedDefs.isThreadViewPost(reply)) {
          replies.push(this.serializeThreadNode(reply));
        }
        // Ignore NotFoundPost and BlockedPost for now
      }
    }

    return {
      post: serializedPost,
      parent,
      replies,
    };
  }
}
