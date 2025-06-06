/**
 * React Query hook for timeline data
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import { feedService } from '../services/atproto'
import { useErrorHandler } from './useErrorHandler'
import type { TimelineResponse } from '../types/atproto'

export const useTimeline = () => {
  const { handleError } = useErrorHandler()

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
        return await feedService.getTimeline(pageParam)
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

// Hook for author-specific feeds
export const useAuthorFeed = (actor: string) => {
  const { handleError } = useErrorHandler()

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