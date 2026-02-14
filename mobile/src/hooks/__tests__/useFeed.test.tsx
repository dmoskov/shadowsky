import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { useTimeline, useCustomFeed } from '../api/useFeed';
import React from 'react';

// Mock React Query
const mockUseInfiniteQuery = useInfiniteQuery as jest.MockedFunction<typeof useInfiniteQuery>;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useInfiniteQuery: jest.fn(),
}));

// Mock the feeds service
jest.mock('../../services/atproto/feeds');

describe('Feed hooks', () => {
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

  describe('useTimeline', () => {
    it('fetches timeline data on mount', () => {
      const mockFeedData = {
        pages: [
          {
            cursor: 'cursor-1',
            feed: [
              {
                post: {
                  uri: 'at://did:plc:test/app.bsky.feed.post/1',
                  cid: 'cid-1',
                  author: { did: 'did:plc:test', handle: 'test.bsky.social' },
                  record: { text: 'Test post', createdAt: new Date().toISOString() },
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

      const { result } = renderHook(() => useTimeline(), { wrapper });

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

      const { result } = renderHook(() => useTimeline(), { wrapper });

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

      const { result } = renderHook(() => useTimeline(), { wrapper });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(mockError);
    });

    it('supports pagination', () => {
      const mockFetchNextPage = jest.fn();

      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ cursor: 'cursor-1', feed: [] }], pageParams: [undefined] },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(() => useTimeline(), { wrapper });

      expect(result.current.hasNextPage).toBe(true);
      result.current.fetchNextPage();
      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('supports pull to refresh', () => {
      const mockRefetch = jest.fn();

      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ cursor: 'cursor-1', feed: [] }], pageParams: [undefined] },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: mockRefetch,
        status: 'success',
      } as any);

      const { result } = renderHook(() => useTimeline(), { wrapper });

      result.current.refetch();
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('useCustomFeed', () => {
    it('fetches custom feed with a feed URI', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ cursor: 'cursor-1', feed: [] }], pageParams: [undefined] },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const { result } = renderHook(
        () => useCustomFeed('at://did:plc:test/app.bsky.feed.generator/whats-hot'),
        { wrapper }
      );

      expect(mockUseInfiniteQuery).toHaveBeenCalled();
      expect(result.current.data).toBeDefined();
    });
  });
});
