/**
 * React Query hook for timeline data with IndexedDB persistence
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import { feedService } from '../services/atproto'
import { useErrorHandler } from './useErrorHandler'
import { useAuth } from '../contexts/AuthContext'
import { feedStorage } from '@bsky/shared'
import type { TimelineResponse } from '@bsky/shared'

export const useTimeline = () => {
  const { logout } = useAuth()
  const { handleError } = useErrorHandler({ logout })

  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: async ({ pageParam }) => {
      try {
        const response = await feedService.getTimeline(pageParam)
        
        // Save to IndexedDB in the background
        if (response.feed && response.feed.length > 0) {
          feedStorage.saveFeedPage('timeline', response.feed, response.cursor)
            .then(() => {
              // Update metadata
              return feedStorage.saveMetadata('timeline', {
                lastUpdate: Date.now(),
                totalCount: response.feed.length,
                version: '1.0'
              })
            })
            .catch(err => debug.error('Failed to cache timeline:', err))
        }
        
        return response
      } catch (error) {
        handleError(error)
        throw error
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TimelineResponse) => lastPage.cursor,
    // Keep previous data while fetching
    placeholderData: (previousData) => previousData,
  })

  // Flatten pages into a single array of posts
  // Filter out replies to only show top-level posts and reposts
  const posts = data?.pages.flatMap(page => 
    page.feed.filter(item => 
      // Include reposts
      item.reason?.$type === 'app.bsky.feed.defs#reasonRepost' ||
      // Include only top-level posts (no reply field)
      !item.reply
    )
  ) ?? []

  return {
    posts,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    hasNextPage: hasNextPage ?? false,
    loadMore: fetchNextPage,
    refresh: refetch,
  }
}

// Hook for author-specific feeds
export const useAuthorFeed = (actor: string) => {
  const { logout } = useAuth()
  const { handleError } = useErrorHandler({ logout })

  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['authorFeed', actor],
    queryFn: async ({ pageParam }) => {
      try {
        return await feedService.getAuthorFeed(actor, pageParam)
      } catch (error) {
        handleError(error)
        throw error
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TimelineResponse) => lastPage.cursor,
    enabled: !!actor,
    placeholderData: (previousData) => previousData,
  })

  const posts = data?.pages.flatMap(page => page.feed) ?? []

  return {
    posts,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    hasNextPage: hasNextPage ?? false,
    loadMore: fetchNextPage,
    refresh: refetch,
  }
}