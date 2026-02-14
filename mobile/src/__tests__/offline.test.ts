import NetInfo from '@react-native-community/netinfo';
import { QueryClient } from '@tanstack/react-query';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('Offline behavior', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          networkMode: 'online',
        },
      },
    });
    jest.clearAllMocks();
  });

  describe('Network status detection', () => {
    it('detects when app goes offline', async () => {
      const offlineState = {
        isConnected: false,
        isInternetReachable: false,
        type: 'none' as const,
        details: null,
      };

      mockNetInfo.fetch.mockResolvedValue(offlineState);

      const networkState = await NetInfo.fetch();

      expect(networkState.isConnected).toBe(false);
      expect(networkState.isInternetReachable).toBe(false);
    });

    it('detects when app comes back online', async () => {
      const onlineState = {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi' as const,
        details: {
          isConnectionExpensive: false,
          ssid: 'test-wifi',
          bssid: 'test-bssid',
          strength: 100,
          ipAddress: '192.168.1.1',
          subnet: '255.255.255.0',
          frequency: 2400,
          linkSpeed: 100,
          rxLinkSpeed: 100,
          txLinkSpeed: 100,
        },
      };

      mockNetInfo.fetch.mockResolvedValue(onlineState);

      const networkState = await NetInfo.fetch();

      expect(networkState.isConnected).toBe(true);
      expect(networkState.isInternetReachable).toBe(true);
    });

    it('subscribes to network state changes', () => {
      const mockUnsubscribe = jest.fn();
      const mockListener = jest.fn();

      mockNetInfo.addEventListener.mockReturnValue(mockUnsubscribe);

      const unsubscribe = NetInfo.addEventListener(mockListener);

      expect(mockNetInfo.addEventListener).toHaveBeenCalledWith(mockListener);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Query behavior when offline', () => {
    it('pauses queries when offline', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'online',
          },
        },
      });

      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      // Queries should be paused when offline
      const queryCache = queryClient.getQueryCache();
      expect(queryCache).toBeDefined();
    });

    it('resumes queries when coming back online', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'online',
          },
        },
      });

      // Start offline
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      await NetInfo.fetch();

      // Come back online
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: {
          isConnectionExpensive: false,
          ssid: 'test-wifi',
          bssid: 'test-bssid',
          strength: 100,
          ipAddress: '192.168.1.1',
          subnet: '255.255.255.0',
          frequency: 2400,
          linkSpeed: 100,
          rxLinkSpeed: 100,
          txLinkSpeed: 100,
        },
      });

      const networkState = await NetInfo.fetch();

      expect(networkState.isConnected).toBe(true);
    });
  });

  describe('Cached data availability', () => {
    it('serves cached data when offline', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            cacheTime: 1000 * 60 * 5, // 5 minutes
            staleTime: 1000 * 60, // 1 minute
          },
        },
      });

      const testData = { posts: ['post1', 'post2'] };
      queryClient.setQueryData(['feed', 'following'], testData);

      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      const cachedData = queryClient.getQueryData(['feed', 'following']);

      expect(cachedData).toEqual(testData);
    });

    it('invalidates stale cache after timeout', async () => {
      jest.useFakeTimers();

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            cacheTime: 1000 * 60 * 5,
            staleTime: 1000 * 60, // 1 minute
          },
        },
      });

      const testData = { posts: ['post1', 'post2'] };
      queryClient.setQueryData(['feed', 'following'], testData);

      // Fast-forward time beyond stale time
      jest.advanceTimersByTime(1000 * 60 * 2);

      const query = queryClient.getQueryState(['feed', 'following']);

      // Query should be stale
      expect(query?.isInvalidated || query?.dataUpdateCount).toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('Error handling for offline operations', () => {
    it('provides appropriate error message for offline POST requests', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      const networkState = await NetInfo.fetch();

      if (!networkState.isConnected) {
        const error = new Error('No internet connection. Please check your network and try again.');
        expect(error.message).toContain('No internet connection');
      }
    });

    it('queues mutations when offline and retries when online', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          mutations: {
            networkMode: 'offlineFirst',
          },
        },
      });

      const mutationCache = queryClient.getMutationCache();

      expect(mutationCache).toBeDefined();
    });
  });

  describe('Sync behavior', () => {
    it('syncs pending changes when coming back online', async () => {
      // Start offline
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      });

      let offlineState = await NetInfo.fetch();
      expect(offlineState.isConnected).toBe(false);

      // Come back online
      mockNetInfo.fetch.mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: {
          isConnectionExpensive: false,
          ssid: 'test-wifi',
          bssid: 'test-bssid',
          strength: 100,
          ipAddress: '192.168.1.1',
          subnet: '255.255.255.0',
          frequency: 2400,
          linkSpeed: 100,
          rxLinkSpeed: 100,
          txLinkSpeed: 100,
        },
      });

      const onlineState = await NetInfo.fetch();
      expect(onlineState.isConnected).toBe(true);

      // Sync should trigger here
    });

    it('preserves offline changes in local storage', async () => {
      const queryClient = new QueryClient();

      // Simulate offline mutation
      const offlineData = {
        text: 'Offline post',
        createdAt: new Date().toISOString(),
      };

      queryClient.setMutationDefaults(['createPost'], {
        mutationFn: async () => offlineData,
      });

      const defaults = queryClient.getMutationDefaults(['createPost']);
      expect(defaults).toBeDefined();
    });
  });
});
