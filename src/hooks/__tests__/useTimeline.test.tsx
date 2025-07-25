/**
 * Tests for useTimeline hook
 * This is a critical path that handles feed data fetching
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useTimeline, useAuthorFeed } from '../useTimeline'
import { AllTheProviders, createMockFeedItem } from '../../test/utils'
import type { TimelineResponse } from '@bsky/shared/types/atproto'

// Mock the service module
jest.mock('../../services/atproto', () => ({
  feedService: {
    getTimeline: jest.fn(),
    getAuthorFeed: jest.fn(),
  },
}))

// Mock the error handler
jest.mock('../useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: jest.fn(),
  }),
}))

// Mock auth context
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: jest.fn(),
  }),
}))

describe('useTimeline', () => {
  const { feedService } = require('../../services/atproto')
  
  const mockTimelineResponse: TimelineResponse = {
    cursor: 'next-page-cursor',
    feed: [
      createMockFeedItem({ 
        post: { 
          uri: 'at://did:1/app.bsky.feed.post/1',
          author: { handle: 'user1.bsky.social' }
        } 
      }),
      createMockFeedItem({ 
        post: { 
          uri: 'at://did:2/app.bsky.feed.post/2',
          author: { handle: 'user2.bsky.social' }
        } 
      }),
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    feedService.getTimeline.mockResolvedValue(mockTimelineResponse)
    feedService.getAuthorFeed.mockResolvedValue(mockTimelineResponse)
  })

  describe('initial load', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.posts).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch timeline on mount', async () => {
      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(feedService.getTimeline).toHaveBeenCalledWith(undefined)
      expect(result.current.posts).toHaveLength(2)
      expect(result.current.posts[0].post.uri).toBe('at://did:1/app.bsky.feed.post/1')
    })

    it('should handle empty timeline', async () => {
      feedService.getTimeline.mockResolvedValue({
        feed: [],
        cursor: undefined,
      })

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.posts).toEqual([])
      expect(result.current.hasNextPage).toBe(false)
    })
  })

  describe('pagination', () => {
    it('should load more posts when requested', async () => {
      const secondPageResponse: TimelineResponse = {
        cursor: 'third-page-cursor',
        feed: [
          createMockFeedItem({ 
            post: { 
              uri: 'at://did:3/app.bsky.feed.post/3',
              author: { handle: 'user3.bsky.social' }
            } 
          }),
        ],
      }

      feedService.getTimeline
        .mockResolvedValueOnce(mockTimelineResponse)
        .mockResolvedValueOnce(secondPageResponse)

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasNextPage).toBe(true)

      // Load more
      await result.current.loadMore()

      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false)
      })

      expect(feedService.getTimeline).toHaveBeenCalledTimes(2)
      expect(feedService.getTimeline).toHaveBeenLastCalledWith('next-page-cursor')
      expect(result.current.posts).toHaveLength(3)
    })

    it('should handle no more pages', async () => {
      feedService.getTimeline.mockResolvedValue({
        feed: mockTimelineResponse.feed,
        cursor: undefined, // No cursor means no more pages
      })

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasNextPage).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      const fetchError = new Error('Network error')
      feedService.getTimeline.mockRejectedValue(fetchError)

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe(fetchError)
      expect(result.current.posts).toEqual([])
    })

    it('should propagate errors after handling', async () => {
      const fetchError = new Error('API error')
      feedService.getTimeline.mockRejectedValue(fetchError)

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // The error should be propagated and stored
      expect(result.current.error).toBe(fetchError)
      expect(result.current.posts).toEqual([])
      
      // The error handler is called internally but we've mocked it
      // The important thing is the error is properly propagated
    })
  })

  describe('refresh', () => {
    it('should refetch timeline when refresh is called', async () => {
      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(feedService.getTimeline).toHaveBeenCalledTimes(1)

      // Refresh
      await result.current.refresh()

      expect(feedService.getTimeline).toHaveBeenCalledTimes(2)
    })

    it('should indicate fetching state during refresh', async () => {
      // Mock a delayed response to capture fetching state
      let resolveRefresh: ((value: any) => void) | null = null
      feedService.getTimeline
        .mockResolvedValueOnce(mockTimelineResponse) // Initial load
        .mockImplementationOnce(() => new Promise(resolve => {
          resolveRefresh = resolve
        }))

      const { result } = renderHook(() => useTimeline(), {
        wrapper: AllTheProviders,
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Start refresh
      result.current.refresh()

      // Wait for fetching state
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true)
      })
      expect(result.current.isLoading).toBe(false)

      // Resolve the refresh
      resolveRefresh!(mockTimelineResponse)

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false)
      })
    })
  })
})

describe('useAuthorFeed', () => {
  const { feedService } = require('../../services/atproto')
  
  const mockAuthorFeedResponse: TimelineResponse = {
    cursor: 'author-next-cursor',
    feed: [
      createMockFeedItem({ 
        post: { 
          uri: 'at://did:author/app.bsky.feed.post/1',
          author: { 
            handle: 'author.bsky.social',
            did: 'did:plc:author123'
          }
        } 
      }),
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    feedService.getAuthorFeed.mockResolvedValue(mockAuthorFeedResponse)
  })

  it('should fetch posts for specific author', async () => {
    const authorHandle = 'author.bsky.social'
    
    const { result } = renderHook(() => useAuthorFeed(authorHandle), {
      wrapper: AllTheProviders,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(feedService.getAuthorFeed).toHaveBeenCalledWith(authorHandle, undefined)
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].post.author.handle).toBe('author.bsky.social')
  })

  it('should not fetch if no actor provided', () => {
    const { result } = renderHook(() => useAuthorFeed(''), {
      wrapper: AllTheProviders,
    })

    // Should not be loading since query is disabled
    expect(result.current.isLoading).toBe(false)
    expect(feedService.getAuthorFeed).not.toHaveBeenCalled()
    expect(result.current.posts).toEqual([])
  })

  it('should refetch when actor changes', async () => {
    const { result, rerender } = renderHook(
      ({ actor }) => useAuthorFeed(actor),
      {
        wrapper: AllTheProviders,
        initialProps: { actor: 'user1.bsky.social' },
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(feedService.getAuthorFeed).toHaveBeenCalledWith('user1.bsky.social', undefined)

    // Change actor
    rerender({ actor: 'user2.bsky.social' })

    await waitFor(() => {
      expect(feedService.getAuthorFeed).toHaveBeenCalledWith('user2.bsky.social', undefined)
    })
  })

  it('should handle pagination for author feed', async () => {
    const secondPageResponse: TimelineResponse = {
      cursor: undefined,
      feed: [
        createMockFeedItem({ 
          post: { 
            uri: 'at://did:author/app.bsky.feed.post/2',
            author: { handle: 'author.bsky.social' }
          } 
        }),
      ],
    }

    feedService.getAuthorFeed
      .mockResolvedValueOnce(mockAuthorFeedResponse)
      .mockResolvedValueOnce(secondPageResponse)

    const { result } = renderHook(() => useAuthorFeed('author.bsky.social'), {
      wrapper: AllTheProviders,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasNextPage).toBe(true)

    // Load more
    await result.current.loadMore()

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(2)
    })

    expect(feedService.getAuthorFeed).toHaveBeenCalledTimes(2)
    expect(feedService.getAuthorFeed).toHaveBeenLastCalledWith('author.bsky.social', 'author-next-cursor')
    expect(result.current.hasNextPage).toBe(false)
  })
})