import {useQuery} from '@tanstack/react-query';
import {AppBskyFeedDefs} from '@atproto/api';
import {getAuthorFeed} from '../../services/atproto/feeds';

export interface TopPostEngagement {
  uri: string;
  text: string;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
  totalEngagement: number;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  post: AppBskyFeedDefs.PostView;
}

export interface TopPostsResult {
  topPosts: TopPostEngagement[];
  totalPostsAnalyzed: number;
}

export interface UseTopPostsOptions {
  handle: string;
  limit?: number;
  maxPages?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch an author's top posts sorted by engagement.
 * Pages through the author's feed and ranks posts by likes + reposts + replies.
 */
export function useTopPosts({
  handle,
  limit = 10,
  maxPages = 10,
  enabled = true,
}: UseTopPostsOptions) {
  return useQuery<TopPostsResult>({
    queryKey: ['top-posts', handle, limit, maxPages],
    queryFn: async (): Promise<TopPostsResult> => {
      const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < maxPages; page++) {
        const response = await getAuthorFeed(handle, {
          limit: 100,
          cursor,
          filter: 'posts_no_replies',
        });

        // Filter out reposts
        const filteredPosts = response.feed.filter((item) => {
          const isRepost =
            item.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
          return !isRepost;
        });

        allPosts.push(...filteredPosts);
        cursor = response.cursor;

        if (!cursor) break;
      }

      const postsWithEngagement: TopPostEngagement[] = allPosts.map((item) => ({
        uri: item.post.uri,
        text:
          (item.post.record as {text?: string} | undefined)?.text || '',
        createdAt: item.post.indexedAt,
        likes: item.post.likeCount || 0,
        reposts: item.post.repostCount || 0,
        replies: item.post.replyCount || 0,
        totalEngagement:
          (item.post.likeCount || 0) +
          (item.post.repostCount || 0) +
          (item.post.replyCount || 0),
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName,
          avatar: item.post.author.avatar,
        },
        post: item.post,
      }));

      const topPosts = [...postsWithEngagement]
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, limit);

      return {
        topPosts,
        totalPostsAnalyzed: postsWithEngagement.length,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!handle && enabled,
  });
}
