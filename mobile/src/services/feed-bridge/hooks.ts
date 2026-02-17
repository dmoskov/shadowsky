/**
 * React hooks for feed serialization
 *
 * Provides hooks to serialize feed data and manage incremental updates
 * for SwiftUI feed views.
 */

import {useCallback, useEffect, useMemo, useRef} from 'react';
import {UseInfiniteQueryResult, InfiniteData} from '@tanstack/react-query';
import {AppBskyFeedDefs} from '@atproto/api';
import {
  extractPostsFromPages,
  serializeFeedPosts,
  serializeToJSON,
  createBatchUpdate,
  createPostUpdate,
} from './serializer';
import {SerializedFeedData, SerializedFeedViewPost, PostUpdate, FeedBatchUpdate} from './types';

/**
 * Options for feed serialization
 */
export interface UseFeedSerializerOptions {
  isOnline?: boolean;
  isFromCache?: boolean;
  bookmarkedPostUris?: Set<string>;
}

/**
 * Result from feed serialization hook
 */
export interface UseFeedSerializerResult {
  /** Serialized feed data ready for Swift */
  serializedData: SerializedFeedData | null;
  /** JSON string for passing to Swift */
  serializedJSON: string | null;
  /** Create an incremental update for changed posts */
  createIncrementalUpdate: (updates: PostUpdate[]) => FeedBatchUpdate;
  /** Serialize incremental update to JSON */
  serializeUpdate: (update: FeedBatchUpdate) => string;
}

/**
 * Hook to serialize feed data for Swift consumption
 *
 * This hook takes React Query feed data and serializes it into a format
 * optimized for Swift Codable decoding.
 */
export function useFeedSerializer(
  query: UseInfiniteQueryResult<InfiniteData<{
    feed: AppBskyFeedDefs.FeedViewPost[];
    cursor?: string;
  }>>,
  options: UseFeedSerializerOptions = {}
): UseFeedSerializerResult {
  const {isOnline = true, isFromCache = false, bookmarkedPostUris} = options;

  // Cache serialized pages to avoid re-serializing unchanged pages
  const serializedPagesCache = useRef<Map<number, SerializedFeedViewPost[]>>(new Map());
  const prevPageCountRef = useRef(0);

  // Get cursor from last page
  const cursor = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return undefined;
    return pages[pages.length - 1].cursor;
  }, [query.data?.pages]);

  // Incrementally serialize feed data — only serialize new/changed pages
  const serializedData = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) {
      serializedPagesCache.current.clear();
      prevPageCountRef.current = 0;
      return null;
    }

    // If page count decreased (e.g., maxPages eviction), rebuild cache
    if (pages.length < prevPageCountRef.current) {
      serializedPagesCache.current.clear();
    }

    // Serialize only pages that aren't cached
    const allSerializedPosts: SerializedFeedViewPost[] = [];
    for (let i = 0; i < pages.length; i++) {
      let serializedPage = serializedPagesCache.current.get(i);

      // Re-serialize if this is a new page or the last page (which may have been updated)
      if (!serializedPage || i === pages.length - 1 || i >= prevPageCountRef.current) {
        const pagePosts = pages[i].feed || [];
        const enhancedPosts = bookmarkedPostUris
          ? pagePosts.map(post => ({
              ...post,
              _isBookmarked: bookmarkedPostUris.has(post.post.uri),
            }))
          : pagePosts;
        serializedPage = serializeFeedPosts(enhancedPosts as any);
        serializedPagesCache.current.set(i, serializedPage);
      }

      allSerializedPosts.push(...serializedPage);
    }

    // Prune cache entries beyond current page count
    for (const key of serializedPagesCache.current.keys()) {
      if (key >= pages.length) {
        serializedPagesCache.current.delete(key);
      }
    }

    prevPageCountRef.current = pages.length;

    if (allSerializedPosts.length === 0) return null;

    return {
      posts: allSerializedPosts,
      metadata: {
        timestamp: Date.now(),
        isOnline,
        isFromCache,
      },
      cursor,
    } as SerializedFeedData;
  }, [query.data?.pages, isOnline, isFromCache, cursor, bookmarkedPostUris]);

  // Serialize to JSON
  const serializedJSON = useMemo(() => {
    return serializedData ? serializeToJSON(serializedData) : null;
  }, [serializedData]);

  // Create incremental update
  const createIncrementalUpdate = useCallback((updates: PostUpdate[]): FeedBatchUpdate => {
    return createBatchUpdate(updates);
  }, []);

  // Serialize update to JSON
  const serializeUpdate = useCallback((update: FeedBatchUpdate): string => {
    return serializeToJSON(update);
  }, []);

  return {
    serializedData,
    serializedJSON,
    createIncrementalUpdate,
    serializeUpdate,
  };
}

/**
 * Hook to track and generate incremental updates
 *
 * Detects changes in like/repost counts and viewer state,
 * and generates efficient incremental updates.
 */
export function useFeedIncrementalUpdates(
  query: UseInfiniteQueryResult<InfiniteData<{
    feed: AppBskyFeedDefs.FeedViewPost[];
    cursor?: string;
  }>>,
  onUpdate?: (update: FeedBatchUpdate) => void
) {
  const prevPostsRef = useRef<Map<string, AppBskyFeedDefs.PostView>>(new Map());

  useEffect(() => {
    const posts = extractPostsFromPages(query.data?.pages);
    if (posts.length === 0) return;

    const updates: PostUpdate[] = [];
    const currentUris = new Set<string>();

    // Compare current posts with previous state
    posts.forEach(feedPost => {
      const post = feedPost.post;
      currentUris.add(post.uri);
      const prevPost = prevPostsRef.current.get(post.uri);

      if (!prevPost) {
        // New post, store it
        prevPostsRef.current.set(post.uri, post);
        return;
      }

      // Check for changes
      const hasChanges =
        prevPost.likeCount !== post.likeCount ||
        prevPost.repostCount !== post.repostCount ||
        prevPost.replyCount !== post.replyCount ||
        prevPost.viewer?.like !== post.viewer?.like ||
        prevPost.viewer?.repost !== post.viewer?.repost;

      if (hasChanges) {
        updates.push(
          createPostUpdate(post.uri, {
            likeCount: post.likeCount,
            repostCount: post.repostCount,
            replyCount: post.replyCount,
            viewer: post.viewer
              ? {
                  like: post.viewer.like,
                  repost: post.viewer.repost,
                }
              : undefined,
          })
        );

        // Update stored post
        prevPostsRef.current.set(post.uri, post);
      }
    });

    // Prune entries for posts no longer in the current pages
    for (const uri of prevPostsRef.current.keys()) {
      if (!currentUris.has(uri)) {
        prevPostsRef.current.delete(uri);
      }
    }

    // Send updates if any
    if (updates.length > 0 && onUpdate) {
      const batchUpdate = createBatchUpdate(updates);
      onUpdate(batchUpdate);
    }
  }, [query.data?.pages, onUpdate]);

  return {
    reset: () => {
      prevPostsRef.current.clear();
    },
  };
}

/**
 * Hook to serialize bookmark state changes
 *
 * Tracks bookmark state and generates updates when bookmarks change.
 */
export function useBookmarkUpdates(
  bookmarkedPostUris: Set<string>,
  onUpdate?: (update: FeedBatchUpdate) => void
) {
  const prevBookmarksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const updates: PostUpdate[] = [];

    // Find newly bookmarked posts
    bookmarkedPostUris.forEach(uri => {
      if (!prevBookmarksRef.current.has(uri)) {
        updates.push(createPostUpdate(uri, {isBookmarked: true}));
      }
    });

    // Find newly unbookmarked posts
    prevBookmarksRef.current.forEach(uri => {
      if (!bookmarkedPostUris.has(uri)) {
        updates.push(createPostUpdate(uri, {isBookmarked: false}));
      }
    });

    // Send updates if any
    if (updates.length > 0 && onUpdate) {
      const batchUpdate = createBatchUpdate(updates);
      onUpdate(batchUpdate);
    }

    // Update reference
    prevBookmarksRef.current = new Set(bookmarkedPostUris);
  }, [bookmarkedPostUris, onUpdate]);
}

/**
 * Hook to integrate all serialization features
 *
 * Combines full serialization with incremental updates and bookmark tracking.
 */
export function useCompleteFeedSerializer(
  query: UseInfiniteQueryResult<InfiniteData<{
    feed: AppBskyFeedDefs.FeedViewPost[];
    cursor?: string;
  }>>,
  options: UseFeedSerializerOptions & {
    onIncrementalUpdate?: (update: FeedBatchUpdate) => void;
  } = {}
): UseFeedSerializerResult {
  const {onIncrementalUpdate, ...serializerOptions} = options;

  // Main serialization
  const serializer = useFeedSerializer(query, serializerOptions);

  // Incremental updates for like/repost changes
  useFeedIncrementalUpdates(query, onIncrementalUpdate);

  // Bookmark updates
  if (serializerOptions.bookmarkedPostUris) {
    useBookmarkUpdates(serializerOptions.bookmarkedPostUris, onIncrementalUpdate);
  }

  return serializer;
}
