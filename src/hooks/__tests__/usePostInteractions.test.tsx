/**
 * Tests for usePostInteractions hook
 * This is a critical path that handles post likes and reposts
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { usePostInteractions } from '../usePostInteractions';
import { AllTheProviders, createMockPost, createMockFeedItem } from '../../test/utils';
import type { Post, FeedItem } from '../../types/atproto';

// Mock the atproto service module
jest.mock('../../services/atproto', () => ({
  atProtoClient: {
    getAgent: jest.fn(),
  },
  getInteractionsService: jest.fn(),
}));

// Mock error handler
jest.mock('../useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: jest.fn(),
  }),
}));

// Mock auth context
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    session: { did: 'did:example:123' },
    client: {
      getAgent: () => ({
        session: { did: 'did:example:123' },
      }),
    },
  }),
}));

describe('usePostInteractions', () => {
  let queryClient: QueryClient;
  let mockAgent: any;
  let mockInteractionsService: any;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Set up mocks
    mockInteractionsService = {
      likePost: jest.fn(),
      unlikePost: jest.fn(),
      repostPost: jest.fn(),
      deleteRepost: jest.fn(),
    };

    mockAgent = {
      session: { did: 'did:example:123' },
    };

    // Configure mocks
    const { atProtoClient, getInteractionsService } = require('../../services/atproto');
    atProtoClient.getAgent.mockReturnValue(mockAgent);
    getInteractionsService.mockReturnValue(mockInteractionsService);

    // Clear all mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('likePost', () => {
    it('should like a post that is not already liked', async () => {
      const mockPost = createMockPost({ viewer: { like: null } });
      const mockLikeUri = 'at://did:example:123/app.bsky.feed.like/abc';
      
      // Mock successful like
      mockInteractionsService.likePost.mockResolvedValue({ uri: mockLikeUri });

      // Set up initial timeline data
      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Like the post
      await act(async () => {
        await result.current.likePost(mockPost);
      });

      // Verify the service was called
      expect(mockInteractionsService.likePost).toHaveBeenCalledWith(mockPost);

      // Check optimistic update
      const updatedData = queryClient.getQueryData(['timeline']) as any;
      expect(updatedData.pages[0].feed[0].post.likeCount).toBe(6); // 5 + 1
      expect(updatedData.pages[0].feed[0].post.viewer.like).toBe(mockLikeUri);
    });

    it('should unlike a post that is already liked', async () => {
      const likeUri = 'at://did:example:123/app.bsky.feed.like/xyz';
      const mockPost = createMockPost({ 
        viewer: { like: likeUri },
        likeCount: 5
      });
      
      // Mock successful unlike
      mockInteractionsService.unlikePost.mockResolvedValue({});

      // Set up initial timeline data
      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Unlike the post
      await act(async () => {
        await result.current.likePost(mockPost);
      });

      // Verify the service was called
      expect(mockInteractionsService.unlikePost).toHaveBeenCalledWith(likeUri);

      // Check optimistic update
      const updatedData = queryClient.getQueryData(['timeline']) as any;
      expect(updatedData.pages[0].feed[0].post.likeCount).toBe(4); // 5 - 1
      expect(updatedData.pages[0].feed[0].post.viewer.like).toBeUndefined();
    });

    it('should handle errors and revert optimistic updates', async () => {
      const mockPost = createMockPost({ viewer: { like: null } });
      const mockError = new Error('Network error');
      
      // Mock failed like
      mockInteractionsService.likePost.mockRejectedValue(mockError);

      // Set up initial timeline data
      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Try to like the post
      await act(async () => {
        try {
          await result.current.likePost(mockPost);
        } catch (error) {
          // Expected to throw
        }
      });

      // Wait for reversion
      await waitFor(() => {
        const revertedData = queryClient.getQueryData(['timeline']) as any;
        expect(revertedData.pages[0].feed[0].post.likeCount).toBe(5); // Original count
        expect(revertedData.pages[0].feed[0].post.viewer.like).toBeNull();
      });
    });

    it('should handle authentication errors', async () => {
      // Mock no agent (not authenticated)
      const { atProtoClient } = require('../../services/atproto');
      atProtoClient.getAgent.mockReturnValue(null);

      const mockPost = createMockPost();

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Try to like without authentication
      await expect(result.current.likePost(mockPost)).rejects.toThrow('Not authenticated');
    });
  });

  describe('repostPost', () => {
    it('should repost a post that is not already reposted', async () => {
      const mockPost = createMockPost({ 
        viewer: { repost: null },
        repostCount: 2 
      });
      const mockRepostUri = 'at://did:example:123/app.bsky.feed.repost/abc';
      
      // Mock successful repost
      mockInteractionsService.repostPost.mockResolvedValue({ uri: mockRepostUri });

      // Set up initial timeline data
      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Repost the post
      await act(async () => {
        await result.current.repostPost(mockPost);
      });

      // Verify the service was called
      expect(mockInteractionsService.repostPost).toHaveBeenCalledWith(mockPost);

      // Check optimistic update
      const updatedData = queryClient.getQueryData(['timeline']) as any;
      expect(updatedData.pages[0].feed[0].post.repostCount).toBe(3); // 2 + 1
      expect(updatedData.pages[0].feed[0].post.viewer.repost).toBe(mockRepostUri);
    });

    it('should delete a repost that already exists', async () => {
      const repostUri = 'at://did:example:123/app.bsky.feed.repost/xyz';
      const mockPost = createMockPost({ 
        viewer: { repost: repostUri },
        repostCount: 3
      });
      
      // Mock successful delete
      mockInteractionsService.deleteRepost.mockResolvedValue({});

      // Set up initial timeline data
      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Delete the repost
      await act(async () => {
        await result.current.repostPost(mockPost);
      });

      // Verify the service was called
      expect(mockInteractionsService.deleteRepost).toHaveBeenCalledWith(repostUri);

      // Check optimistic update
      const updatedData = queryClient.getQueryData(['timeline']) as any;
      expect(updatedData.pages[0].feed[0].post.repostCount).toBe(2); // 3 - 1
      expect(updatedData.pages[0].feed[0].post.viewer.repost).toBeUndefined();
    });
  });

  describe('loading states', () => {
    it('should indicate loading state during like operation', async () => {
      const mockPost = createMockPost();
      
      // Use a flag to control when the promise resolves
      let resolveHandler: ((value: any) => void) | null = null;
      mockInteractionsService.likePost.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveHandler = resolve;
        });
      });

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Start the like operation but don't await it
      let likeOperation: Promise<void> | null = null;
      act(() => {
        likeOperation = result.current.likePost(mockPost);
      });

      // The loading state should be true while the promise is pending
      await waitFor(() => {
        expect(result.current.isLiking).toBe(true);
      });
      expect(result.current.isReposting).toBe(false);

      // Now resolve the promise and wait for the operation to complete
      await act(async () => {
        resolveHandler!({ uri: 'test-like-uri' });
        await likeOperation!;
      });

      // After completion, loading state should be false
      await waitFor(() => {
        expect(result.current.isLiking).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle posts with zero counts', async () => {
      const mockPost = createMockPost({ 
        likeCount: 0,
        viewer: { like: 'existing-like' }
      });

      // Mock successful unlike
      mockInteractionsService.unlikePost.mockResolvedValue({});

      const initialData = {
        pages: [{
          feed: [createMockFeedItem({ post: mockPost })]
        }]
      };
      queryClient.setQueryData(['timeline'], initialData);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Unlike when count is already 0
      await act(async () => {
        await result.current.likePost(mockPost);
      });

      // Should not go negative
      const updatedData = queryClient.getQueryData(['timeline']) as any;
      expect(updatedData.pages[0].feed[0].post.likeCount).toBe(0);
    });

    it('should handle posts not in timeline', async () => {
      const mockPost = createMockPost();
      
      // Mock successful like
      mockInteractionsService.likePost.mockResolvedValue({ uri: 'at://new-like' });
      
      // No timeline data
      queryClient.setQueryData(['timeline'], null);

      const { result } = renderHook(() => usePostInteractions(), {
        wrapper: ({ children }) => (
          <AllTheProviders queryClient={queryClient}>
            {children}
          </AllTheProviders>
        ),
      });

      // Should not throw
      await act(async () => {
        await result.current.likePost(mockPost);
      });

      expect(mockInteractionsService.likePost).toHaveBeenCalled();
    });
  });
});