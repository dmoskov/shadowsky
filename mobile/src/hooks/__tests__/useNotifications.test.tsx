import {renderHook, act} from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import React from 'react';

// ─── Mocks ─────────────────────────────────────────────────

const mockUseInfiniteQuery = useInfiniteQuery as jest.MockedFunction<
  typeof useInfiniteQuery
>;
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useInfiniteQuery: jest.fn(),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

jest.mock('../../services/atproto/notifications', () => ({
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  updateSeenNotifications: jest.fn(),
}));

jest.mock('../useAdaptivePolling', () => ({
  useAdaptivePolling: () => 30000,
}));

// ─── Import after mocks ───────────────────────────────────
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationsSeen,
} from '../api/useNotifications';

// ─── Tests ─────────────────────────────────────────────────
describe('Notification hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    });
    jest.clearAllMocks();
  });

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useNotifications', () => {
    it('fetches notifications with infinite query', () => {
      const mockData = {
        pages: [
          {
            notifications: [
              {
                uri: 'at://did:plc:test/app.bsky.feed.like/1',
                reason: 'like',
                author: {handle: 'alice.bsky.social'},
                indexedAt: '2025-01-01T12:00:00.000Z',
              },
            ],
            cursor: 'cursor-1',
          },
        ],
        pageParams: [undefined],
      };

      mockUseInfiniteQuery.mockReturnValue({
        data: mockData,
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn(),
        status: 'success',
      } as any);

      const {result} = renderHook(() => useNotifications(), {wrapper});

      expect(mockUseInfiniteQuery).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockData);
      expect(result.current.hasNextPage).toBe(true);
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

      const {result} = renderHook(() => useNotifications(), {wrapper});
      expect(result.current.isLoading).toBe(true);
    });

    it('handles fetch errors', () => {
      const mockError = new Error('Failed to fetch notifications');

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

      const {result} = renderHook(() => useNotifications(), {wrapper});
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(mockError);
    });

    it('supports pagination with fetchNextPage', () => {
      const mockFetchNextPage = jest.fn();

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{notifications: [], cursor: 'cursor-1'}],
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

      const {result} = renderHook(() => useNotifications(), {wrapper});
      result.current.fetchNextPage();
      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('uses adaptive polling query key', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        status: 'loading',
      } as any);

      renderHook(() => useNotifications(), {wrapper});

      // Verify the query was called with the notifications key
      const callArgs = mockUseInfiniteQuery.mock.calls[0][0] as any;
      expect(callArgs.queryKey).toEqual(['notifications']);
    });
  });

  describe('useUnreadCount', () => {
    it('fetches unread count', () => {
      mockUseQuery.mockReturnValue({
        data: 5,
        isLoading: false,
        isError: false,
      } as any);

      const {result} = renderHook(() => useUnreadCount(), {wrapper});
      expect(result.current.data).toBe(5);
    });

    it('returns zero when no unread', () => {
      mockUseQuery.mockReturnValue({
        data: 0,
        isLoading: false,
        isError: false,
      } as any);

      const {result} = renderHook(() => useUnreadCount(), {wrapper});
      expect(result.current.data).toBe(0);
    });

    it('uses correct query key', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      renderHook(() => useUnreadCount(), {wrapper});

      const callArgs = mockUseQuery.mock.calls[0][0] as any;
      expect(callArgs.queryKey).toEqual(['unreadCount']);
    });
  });

  describe('useMarkNotificationsSeen', () => {
    it('creates a mutation for marking seen', () => {
      const mockMutate = jest.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      const {result} = renderHook(() => useMarkNotificationsSeen(), {wrapper});
      expect(result.current.mutate).toBe(mockMutate);
    });

    it('calls mutate with timestamp', () => {
      const mockMutate = jest.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      const {result} = renderHook(() => useMarkNotificationsSeen(), {wrapper});
      result.current.mutate('2025-01-01T12:00:00.000Z');
      expect(mockMutate).toHaveBeenCalledWith('2025-01-01T12:00:00.000Z');
    });

    it('invalidates queries on success', () => {
      // Capture the onSuccess callback
      mockUseMutation.mockImplementation((options: any) => {
        return {
          mutate: jest.fn(() => {
            // Simulate success
            if (options.onSuccess) {
              options.onSuccess();
            }
          }),
          isPending: false,
        } as any;
      });

      const {result} = renderHook(() => useMarkNotificationsSeen(), {wrapper});

      // Spy on query client invalidation
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      result.current.mutate('2025-01-01T12:00:00.000Z');

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['notifications'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['unreadCount'],
      });
    });
  });
});
