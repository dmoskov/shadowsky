import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { useFeed } from '../api/useFeed';
import React from 'react';

// Mock React Query
const mockUseInfiniteQuery = useInfiniteQuery as jest.MockedFunction<typeof useInfiniteQuery>;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useInfiniteQuery: jest.fn(),
}));

describe('useFeed', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Initial load', () => {
    it('fetches feed data on mount', async () => {
      const mockFeedData = {
        pages: [
          {
            cursor: 'cursor-1',
            feed: [
              {
                post: {
                  uri: 'at://did:plc:test/app.bsky.feed.post/1',
                  cid: 'cid-1',
                  author: {
                    did: 'did:plc:test',
                    handle: 'test.bsky.social',
                    displayName: 'Test User',
                  },
                  record: {
                    text: 'Test post',
                    createdAt: new Date().toISOString(),
                  },
                },
              },
            ],
          },
        ],
        pageParams: [undefined],
      };

      mockUseInfiniteQuery.mockReturnValue({
        data: mockFeedData,
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(mockUseInfiniteQuery).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockFeedData);
    });

    it('shows loading state during initial fetch', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'loading',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('handles fetch errors', () => {
      const mockError = new Error('Failed to fetch feed');

      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'error',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('Pagination', () => {
    it('fetches next page when requested', async () => {
      const mockFetchNextPage = jest.fn();

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [
            {
              cursor: 'cursor-1',
              feed: [
                {
                  post: {
                    uri: 'at://did:plc:test/app.bsky.feed.post/1',
                    cid: 'cid-1',
                    author: {
                      did: 'did:plc:test',
                      handle: 'test.bsky.social',
                    },
                    record: { text: 'Test post 1', createdAt: new Date().toISOString() },
                  },
                },
              ],
            },
          ],
          pageParams: [undefined],
        },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.hasNextPage).toBe(true);
      result.current.fetchNextPage();
      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('indicates when fetching next page', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [
            {
              cursor: 'cursor-1',
              feed: [
                {
                  post: {
                    uri: 'at://did:plc:test/app.bsky.feed.post/1',
                    cid: 'cid-1',
                    author: {
                      did: 'did:plc:test',
                      handle: 'test.bsky.social',
                    },
                    record: { text: 'Test post 1', createdAt: new Date().toISOString() },
                  },
                },
              ],
            },
          ],
          pageParams: [undefined],
        },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.isFetchingNextPage).toBe(true);
    });

    it('indicates when there are no more pages', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [
            {
              cursor: undefined,
              feed: [
                {
                  post: {
                    uri: 'at://did:plc:test/app.bsky.feed.post/1',
                    cid: 'cid-1',
                    author: {
                      did: 'did:plc:test',
                      handle: 'test.bsky.social',
                    },
                    record: { text: 'Test post 1', createdAt: new Date().toISOString() },
                  },
                },
              ],
            },
          ],
          pageParams: [undefined],
        },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('Pull to refresh', () => {
    it('refetches feed data', () => {
      const mockRefetch = jest.fn();

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [
            {
              cursor: 'cursor-1',
              feed: [],
            },
          ],
          pageParams: [undefined],
        },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: mockRefetch,
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      result.current.refetch();
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Cache behavior', () => {
    it('returns cached data when available', () => {
      const cachedData = {
        pages: [
          {
            cursor: 'cursor-1',
            feed: [
              {
                post: {
                  uri: 'at://did:plc:test/app.bsky.feed.post/1',
                  cid: 'cid-1',
                  author: {
                    did: 'did:plc:test',
                    handle: 'test.bsky.social',
                  },
                  record: { text: 'Cached post', createdAt: new Date().toISOString() },
                },
              },
            ],
          },
        ],
        pageParams: [undefined],
      };

      mockUseInfiniteQuery.mockReturnValue({
        data: cachedData,
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useFeed('following'), { wrapper });

      expect(result.current.data).toEqual(cachedData);
    });
  });
});
