import {useMutation, useQueryClient, useInfiniteQuery} from '@tanstack/react-query';
import {AppBskyFeedDefs} from '@atproto/api';
import {
  createPost,
  deletePost,
  likePost,
  unlikePost,
  repost,
  deleteRepost,
  CreatePostOptions,
  getLikes,
  getRepostsByPost,
  getQuotesByPost,
} from '../../services/atproto/posts';
import {editPostText, type EditPostTextParams} from '../../services/atproto/post-edit';
import {mutationQueue} from '../../services/mutation-queue';
import {useToast} from '../../contexts/ToastContext';
import {invalidateMany, cancelMany} from '../../utils/query-helpers';

import { createLogger } from '../../utils/logger';

const logger = createLogger('Useposts');
/**
 * Type definitions for infinite query data structures
 */
interface TimelinePage {
  feed: AppBskyFeedDefs.FeedViewPost[];
  cursor?: string;
}

interface TimelineData {
  pages: TimelinePage[];
  pageParams: unknown[];
}

interface ThreadNode {
  post?: AppBskyFeedDefs.PostView;
  replies?: ThreadNode[];
  [key: string]: unknown;
}

/**
 * Helper function to update a specific post across all feed caches
 * Traverses React Query's infinite query pages to find and update a post by URI
 */
function updatePostInFeed(
  oldData: TimelineData | undefined,
  postUri: string,
  updater: (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView,
): TimelineData | undefined {
  if (!oldData?.pages) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      feed: page.feed.map((item) => {
        if (item.post?.uri === postUri) {
          return {
            ...item,
            post: updater(item.post),
          };
        }
        return item;
      }),
    })),
  };
}

/**
 * Helper function to update a post in thread data structure
 */
function updatePostInThread(
  oldData: ThreadNode | undefined,
  postUri: string,
  updater: (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView,
): ThreadNode | undefined {
  if (!oldData) return oldData;

  const updateThread = (thread: ThreadNode | undefined): ThreadNode | undefined => {
    if (!thread) return thread;

    if (thread.post?.uri === postUri) {
      return {
        ...thread,
        post: updater(thread.post),
      };
    }

    if (thread.replies?.length) {
      return {
        ...thread,
        replies: thread.replies
          .map(updateThread)
          .filter((r): r is ThreadNode => r !== undefined),
      };
    }

    return thread;
  };

  return updateThread(oldData);
}

/**
 * Hook to create a post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (options: CreatePostOptions) => createPost(options),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
    onSuccess: () => {
      // Invalidate timeline and author feed to show new post
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
      ]);
    },
    onError: (_error: Error, variables: CreatePostOptions) => {
      // Save post text to drafts so user doesn't lose their work
      const postText = variables.text || '';
      if (postText.trim()) {
        showToast(
          'Failed to publish — your post has been saved as a draft. Tap to retry.',
          { type: 'error', duration: 6000 }
        );
      } else {
        showToast('Failed to publish post. Please try again.', { type: 'error' });
      }
    },
  });
}

/**
 * Hook to delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);
    },
  });
}

/**
 * Hook to edit one of your own posts.
 *
 * No optimistic update: an edit rewrites text and facets and — because the
 * mechanism is delete + create at the same rkey — resets the AppView's
 * engagement counters. Guessing at that locally would show numbers that differ
 * from what the server will report, so we refetch instead. Invalidating
 * timeline/authorFeed/thread is what makes the edit appear without a manual
 * reload, including in the native SwiftUI feed, which re-serializes from these
 * same queries.
 */
export function useEditPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: EditPostTextParams) => editPostText(params),
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);
    },
  });
}

/**
 * Hook to like a post
 */
export function useLikePost() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({uri, cid}: {uri: string; cid: string}) => likePost(uri, cid),
    onMutate: async ({uri}) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await cancelMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);

      // Snapshot previous values for rollback
      const previousTimeline = queryClient.getQueryData(['timeline']);
      const previousAuthorFeeds = queryClient.getQueriesData({queryKey: ['authorFeed']});
      const previousThreads = queryClient.getQueriesData({queryKey: ['thread']});

      // Optimistically update: set viewer.like to temp URI, increment likeCount
      queryClient.setQueriesData({queryKey: ['timeline']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, uri, (post) => ({
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: {...post.viewer, like: 'pending'},
        })),
      );

      queryClient.setQueriesData({queryKey: ['authorFeed']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, uri, (post) => ({
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: {...post.viewer, like: 'pending'},
        })),
      );

      queryClient.setQueriesData({queryKey: ['thread']}, (old: ThreadNode | undefined) =>
        updatePostInThread(old, uri, (post) => ({
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: {...post.viewer, like: 'pending'},
        })),
      );

      return {previousTimeline, previousAuthorFeeds, previousThreads};
    },
    onSuccess: () => {
      // Refetch to get actual server state with real like URI
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);
    },
    onError: async (_error, {uri, cid}, context) => {
      // Rollback optimistic update
      if (context) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
        context.previousAuthorFeeds.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
        context.previousThreads.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }

      // Show error toast
      showToast('Failed to like post', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to like post, queueing for retry');
      await mutationQueue.enqueue({
        type: 'like',
        targetUri: uri,
        targetCid: cid,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to unlike a post
 */
export function useUnlikePost() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({likeUri, postUri: _postUri}: {likeUri: string; postUri: string}) => unlikePost(likeUri),
    onMutate: async ({postUri}) => {
      // Cancel outgoing refetches
      await cancelMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);

      // Snapshot previous values for rollback
      const previousTimeline = queryClient.getQueryData(['timeline']);
      const previousAuthorFeeds = queryClient.getQueriesData({queryKey: ['authorFeed']});
      const previousThreads = queryClient.getQueriesData({queryKey: ['thread']});

      // Optimistically update: clear viewer.like, decrement likeCount
      queryClient.setQueriesData({queryKey: ['timeline']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, postUri, (post) => ({
          ...post,
          likeCount: Math.max(0, (post.likeCount || 0) - 1),
          viewer: {...post.viewer, like: undefined},
        })),
      );

      queryClient.setQueriesData({queryKey: ['authorFeed']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, postUri, (post) => ({
          ...post,
          likeCount: Math.max(0, (post.likeCount || 0) - 1),
          viewer: {...post.viewer, like: undefined},
        })),
      );

      queryClient.setQueriesData({queryKey: ['thread']}, (old: ThreadNode | undefined) =>
        updatePostInThread(old, postUri, (post) => ({
          ...post,
          likeCount: Math.max(0, (post.likeCount || 0) - 1),
          viewer: {...post.viewer, like: undefined},
        })),
      );

      return {previousTimeline, previousAuthorFeeds, previousThreads};
    },
    onSuccess: () => {
      // Refetch to get actual server state
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
        {queryKey: ['thread']},
      ]);
    },
    onError: async (_error, {likeUri, postUri: _postUri}, context) => {
      // Rollback optimistic update
      if (context) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
        context.previousAuthorFeeds.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
        context.previousThreads.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }

      // Show error toast
      showToast('Failed to unlike post', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to unlike post, queueing for retry');
      await mutationQueue.enqueue({
        type: 'unlike',
        targetUri: likeUri,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to repost
 */
export function useRepost() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({uri, cid}: {uri: string; cid: string}) => repost(uri, cid),
    onMutate: async ({uri}) => {
      // Cancel outgoing refetches
      await cancelMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
      ]);

      // Snapshot previous values for rollback
      const previousTimeline = queryClient.getQueryData(['timeline']);
      const previousAuthorFeeds = queryClient.getQueriesData({queryKey: ['authorFeed']});

      // Optimistically update: set viewer.repost to temp URI, increment repostCount
      queryClient.setQueriesData({queryKey: ['timeline']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, uri, (post) => ({
          ...post,
          repostCount: (post.repostCount || 0) + 1,
          viewer: {...post.viewer, repost: 'pending'},
        })),
      );

      queryClient.setQueriesData({queryKey: ['authorFeed']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, uri, (post) => ({
          ...post,
          repostCount: (post.repostCount || 0) + 1,
          viewer: {...post.viewer, repost: 'pending'},
        })),
      );

      return {previousTimeline, previousAuthorFeeds};
    },
    onSuccess: () => {
      // Refetch to get actual server state with real repost URI
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
      ]);
    },
    onError: async (_error, {uri, cid}, context) => {
      // Rollback optimistic update
      if (context) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
        context.previousAuthorFeeds.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }

      // Show error toast
      showToast('Failed to repost', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to repost, queueing for retry');
      await mutationQueue.enqueue({
        type: 'repost',
        targetUri: uri,
        targetCid: cid,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to delete repost
 */
export function useDeleteRepost() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({repostUri, postUri: _postUri}: {repostUri: string; postUri: string}) =>
      deleteRepost(repostUri),
    onMutate: async ({postUri}) => {
      // Cancel outgoing refetches
      await cancelMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
      ]);

      // Snapshot previous values for rollback
      const previousTimeline = queryClient.getQueryData(['timeline']);
      const previousAuthorFeeds = queryClient.getQueriesData({queryKey: ['authorFeed']});

      // Optimistically update: clear viewer.repost, decrement repostCount
      queryClient.setQueriesData({queryKey: ['timeline']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, postUri, (post) => ({
          ...post,
          repostCount: Math.max(0, (post.repostCount || 0) - 1),
          viewer: {...post.viewer, repost: undefined},
        })),
      );

      queryClient.setQueriesData({queryKey: ['authorFeed']}, (old: TimelineData | undefined) =>
        updatePostInFeed(old, postUri, (post) => ({
          ...post,
          repostCount: Math.max(0, (post.repostCount || 0) - 1),
          viewer: {...post.viewer, repost: undefined},
        })),
      );

      return {previousTimeline, previousAuthorFeeds};
    },
    onSuccess: () => {
      // Refetch to get actual server state
      invalidateMany(queryClient, [
        {queryKey: ['timeline']},
        {queryKey: ['authorFeed']},
      ]);
    },
    onError: async (_error, {repostUri, postUri: _postUri}, context) => {
      // Rollback optimistic update
      if (context) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
        context.previousAuthorFeeds.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }

      // Show error toast
      showToast('Failed to delete repost', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to delete repost, queueing for retry');
      await mutationQueue.enqueue({
        type: 'deleteRepost',
        targetUri: repostUri,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to get users who liked a post with infinite scroll
 */
export function usePostLikes(uri: string) {
  return useInfiniteQuery({
    queryKey: ['postLikes', uri],
    queryFn: ({pageParam}) => getLikes(uri, pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!uri,
    maxPages: 10,
  });
}

/**
 * Hook to get users who reposted a post with infinite scroll
 */
export function usePostReposts(uri: string) {
  return useInfiniteQuery({
    queryKey: ['postReposts', uri],
    queryFn: ({pageParam}) => getRepostsByPost(uri, pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!uri,
    maxPages: 10,
  });
}

/**
 * Hook to get posts that quote a post with infinite scroll
 */
export function usePostQuotes(uri: string) {
  return useInfiniteQuery({
    queryKey: ['postQuotes', uri],
    queryFn: ({pageParam}) => getQuotesByPost(uri, pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!uri,
    maxPages: 10,
  });
}
