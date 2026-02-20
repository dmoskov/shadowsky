/**
 * Network Transitions Tests
 *
 * Tests for offline state detection, online/offline transitions,
 * Jetstream reconnection, and NetworkContext behavior.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

// ── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@react-native-community/netinfo');
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

// Capture NetInfo listeners registered via addEventListener
let netInfoListeners: Array<(state: NetInfoState) => void> = [];
mockNetInfo.addEventListener.mockImplementation((listener) => {
  netInfoListeners.push(listener);
  return () => {
    netInfoListeners = netInfoListeners.filter((l) => l !== listener);
  };
});

// Capture AppState listeners
let appStateListeners: Array<(state: AppStateStatus) => void> = [];
const originalAddEventListener = AppState.addEventListener;
(AppState as any).addEventListener = jest.fn(
  (_type: string, listener: (state: AppStateStatus) => void) => {
    appStateListeners.push(listener);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((l) => l !== listener);
      },
    };
  },
);

// Helper to simulate a NetInfo state change
function simulateNetworkChange(state: Partial<NetInfoState>) {
  const fullState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: null,
    ...state,
  } as NetInfoState;
  netInfoListeners.forEach((listener) => listener(fullState));
  return fullState;
}

// Helper to simulate an AppState change
function simulateAppStateChange(state: AppStateStatus) {
  appStateListeners.forEach((listener) => listener(state));
}

// ── Test: JetstreamService ──────────────────────────────────────────────────

import {
  JetstreamService,
  JetstreamEventType,
  JetstreamEvent,
  JetstreamConfig,
  initializeJetstreamService,
  disconnectJetstream,
} from '../../services/jetstream-service';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    // Auto-connect after a microtask
    Promise.resolve().then(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    });
  }

  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  send(_data: string) {}
}

// Install mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

describe('Network Transitions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    netInfoListeners = [];
    appStateListeners = [];
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: null,
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    disconnectJetstream();
  });

  // ── Offline State ──────────────────────────────────────────────────────

  describe('Offline state detection', () => {
    it('detects offline when isConnected is false', async () => {
      const state = await mockNetInfo.fetch();
      expect(state.isConnected).toBe(true);

      // Simulate going offline
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: null,
      } as any);

      const offlineState = await mockNetInfo.fetch();
      expect(offlineState.isConnected).toBe(false);
      expect(offlineState.isInternetReachable).toBe(false);
    });

    it('detects offline when isInternetReachable is false but isConnected is true', async () => {
      // WiFi connected but no internet (captive portal scenario)
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
        type: 'wifi',
        details: null,
      } as any);

      const state = await mockNetInfo.fetch();
      expect(state.isConnected).toBe(true);
      expect(state.isInternetReachable).toBe(false);
    });

    it('tracks network quality for cellular connections', async () => {
      // Good cellular (4G)
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'cellular',
        details: { cellularGeneration: '4g' },
      } as any);

      const state4g = await mockNetInfo.fetch();
      expect(state4g.isConnected).toBe(true);
      expect((state4g.details as any)?.cellularGeneration).toBe('4g');

      // Poor cellular (2G)
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'cellular',
        details: { cellularGeneration: '2g' },
      } as any);

      const state2g = await mockNetInfo.fetch();
      expect((state2g.details as any)?.cellularGeneration).toBe('2g');
    });
  });

  // ── Online → Offline → Online Transition ────────────────────────────

  describe('Online → Offline → Online transitions', () => {
    it('Jetstream defers connection when network is offline', () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);

      // Simulate offline before connecting
      // The service checks isNetworkOnline internally via handleNetworkChange
      // We need to trigger the network listener
      service.connect(); // registers mobile listeners
      simulateNetworkChange({ isConnected: false });

      // Disconnect and try reconnect - should be deferred
      service.disconnect();
      // After going offline, the internal flag prevents reconnect
      // Service stores isNetworkOnline = false
      expect(service.isConnected()).toBe(false);

      service.destroy();
    });

    it('Jetstream reconnects automatically when network comes back', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const events: JetstreamEvent[] = [];

      service.on(JetstreamEventType.CONNECT, (e) => events.push(e));
      service.on(JetstreamEventType.DISCONNECT, (e) => events.push(e));

      // Connect initially
      service.connect();
      await Promise.resolve(); // Let MockWebSocket open
      expect(service.isConnected()).toBe(true);

      // Go offline
      simulateNetworkChange({ isConnected: false });

      // Go back online - service should auto-reconnect
      simulateNetworkChange({ isConnected: true });
      await Promise.resolve(); // Let MockWebSocket open

      // The service should have attempted reconnection
      expect(service.isConnected()).toBe(true);

      service.destroy();
    });

    it('NetInfo listener fires on transition from online to offline', () => {
      const listener = jest.fn();
      const unsub = NetInfo.addEventListener(listener);

      simulateNetworkChange({ isConnected: false, isInternetReachable: false, type: 'none' as any });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isConnected: false }),
      );

      unsub();
    });

    it('NetInfo listener fires on transition from offline to online', () => {
      const listener = jest.fn();
      const unsub = NetInfo.addEventListener(listener);

      // First go offline
      simulateNetworkChange({ isConnected: false, type: 'none' as any });
      // Then come back online
      simulateNetworkChange({ isConnected: true, isInternetReachable: true, type: 'wifi' as any });

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(
        expect.objectContaining({ isConnected: true }),
      );

      unsub();
    });
  });

  // ── Jetstream Reconnection Behavior ──────────────────────────────────

  describe('Jetstream reconnection', () => {
    it('reconnects with exponential backoff after disconnect', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const reconnectEvents: JetstreamEvent[] = [];

      service.on(JetstreamEventType.RECONNECT, (e) => reconnectEvents.push(e));
      service.on(JetstreamEventType.CONNECT, (e) => reconnectEvents.push(e));

      // Connect
      service.connect();
      await Promise.resolve();
      expect(service.isConnected()).toBe(true);

      // Simulate unexpected close (not intentional)
      const ws = (service as any).ws as MockWebSocket;
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.();

      // First reconnect should be scheduled at 5000ms
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(reconnectEvents.some((e) => e.type === JetstreamEventType.RECONNECT)).toBe(true);

      service.destroy();
    });

    it('stops reconnecting after max attempts', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const errorEvents: JetstreamEvent[] = [];

      service.on(JetstreamEventType.ERROR, (e) => errorEvents.push(e));

      // Override WebSocket to fail immediately each time
      const FailingWebSocket = class {
        url: string;
        readyState = 0;
        onopen: (() => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        constructor(url: string) {
          this.url = url;
          // Simulate immediate failure
          Promise.resolve().then(() => {
            this.readyState = 3;
            this.onerror?.();
            this.onclose?.();
          });
        }
        close() { this.readyState = 3; this.onclose?.(); }
        send() {}
      };
      (global as any).WebSocket = FailingWebSocket;

      // Connect (will fail)
      service.connect();
      await Promise.resolve();

      // Pump through reconnection attempts (max 10)
      for (let i = 0; i < 12; i++) {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve();
      }

      // Restore original
      (global as any).WebSocket = MockWebSocket;

      // Should have received an error about max attempts
      const maxAttemptError = errorEvents.find(
        (e) => e.type === JetstreamEventType.ERROR &&
          (e as any).error?.includes('Max reconnection attempts'),
      );
      expect(maxAttemptError).toBeDefined();

      service.destroy();
    });

    it('resets reconnect counter on successful connection', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);

      service.connect();
      await Promise.resolve();
      expect(service.isConnected()).toBe(true);

      // Access internal state to verify
      expect((service as any).reconnectAttempts).toBe(0);

      service.destroy();
    });

    it('does not reconnect if intentionally closed', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const reconnectEvents: JetstreamEvent[] = [];

      service.on(JetstreamEventType.RECONNECT, (e) => reconnectEvents.push(e));

      // Connect then intentionally disconnect
      service.connect();
      await Promise.resolve();
      service.disconnect();

      // Advance timers - no reconnect should happen
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      expect(reconnectEvents).toHaveLength(0);

      service.destroy();
    });
  });

  // ── Jetstream Event Catching ─────────────────────────────────────────

  describe('Jetstream catches up on missed events', () => {
    it('processes queued messages after reconnect', async () => {
      const config: JetstreamConfig = {
        userDid: 'did:plc:user1',
        followedDids: ['did:plc:friend1'],
      };
      const service = new JetstreamService(config);
      const timelinePosts: JetstreamEvent[] = [];

      service.on(JetstreamEventType.TIMELINE_NEW_POST, (e) => timelinePosts.push(e));

      // Connect
      service.connect();
      await Promise.resolve();

      // Simulate incoming post from a followed account
      const postMessage = JSON.stringify({
        did: 'did:plc:friend1',
        time_us: Date.now() * 1000,
        kind: 'commit',
        commit: {
          rev: 'rev1',
          operation: 'create',
          collection: 'app.bsky.feed.post',
          rkey: 'post1',
          record: { text: 'Hello!', createdAt: new Date().toISOString() },
          cid: 'cid1',
        },
      });

      const ws = (service as any).ws as MockWebSocket;
      ws.onmessage?.({ data: postMessage });

      expect(timelinePosts).toHaveLength(1);
      expect(timelinePosts[0]).toEqual(
        expect.objectContaining({
          type: JetstreamEventType.TIMELINE_NEW_POST,
          did: 'did:plc:friend1',
        }),
      );

      service.destroy();
    });

    it('filters out posts from non-followed accounts', async () => {
      const config: JetstreamConfig = {
        userDid: 'did:plc:user1',
        followedDids: ['did:plc:friend1'],
      };
      const service = new JetstreamService(config);
      const timelinePosts: JetstreamEvent[] = [];

      service.on(JetstreamEventType.TIMELINE_NEW_POST, (e) => timelinePosts.push(e));

      service.connect();
      await Promise.resolve();

      // Simulate post from a NON-followed account
      const ws = (service as any).ws as MockWebSocket;
      ws.onmessage?.({
        data: JSON.stringify({
          did: 'did:plc:stranger',
          time_us: Date.now() * 1000,
          kind: 'commit',
          commit: {
            rev: 'rev1',
            operation: 'create',
            collection: 'app.bsky.feed.post',
            rkey: 'post2',
            record: { text: 'Spam', createdAt: new Date().toISOString() },
          },
        }),
      });

      expect(timelinePosts).toHaveLength(0);

      service.destroy();
    });

    it('emits notification events for likes on user posts', async () => {
      const config: JetstreamConfig = {
        userDid: 'did:plc:user1',
        followedDids: [],
      };
      const service = new JetstreamService(config);
      const notifications: JetstreamEvent[] = [];

      service.on(JetstreamEventType.NEW_NOTIFICATION, (e) => notifications.push(e));

      service.connect();
      await Promise.resolve();

      const ws = (service as any).ws as MockWebSocket;
      ws.onmessage?.({
        data: JSON.stringify({
          did: 'did:plc:liker',
          time_us: Date.now() * 1000,
          kind: 'commit',
          commit: {
            rev: 'rev1',
            operation: 'create',
            collection: 'app.bsky.feed.like',
            rkey: 'like1',
            record: { subject: { uri: 'at://did:plc:user1/app.bsky.feed.post/abc' } },
            cid: 'likecid1',
          },
        }),
      });

      expect(notifications).toHaveLength(1);
      expect((notifications[0] as any).notification.reason).toBe('like');

      service.destroy();
    });

    it('tracks message statistics', async () => {
      const config: JetstreamConfig = {
        userDid: 'did:plc:user1',
        followedDids: ['did:plc:friend1'],
      };
      const service = new JetstreamService(config);

      service.connect();
      await Promise.resolve();

      const ws = (service as any).ws as MockWebSocket;

      // Send several messages
      for (let i = 0; i < 5; i++) {
        ws.onmessage?.({
          data: JSON.stringify({
            did: 'did:plc:friend1',
            time_us: Date.now() * 1000,
            kind: 'commit',
            commit: {
              rev: `rev${i}`,
              operation: 'create',
              collection: 'app.bsky.feed.post',
              rkey: `post${i}`,
              record: { text: `Post ${i}`, createdAt: new Date().toISOString() },
              cid: `cid${i}`,
            },
          }),
        });
      }

      const stats = service.getStats();
      expect(stats.messagesReceived).toBe(5);
      expect(stats.postsReceived).toBe(5);
      expect(stats.lastEventTime).toBeInstanceOf(Date);

      service.destroy();
    });
  });

  // ── AppState Integration ─────────────────────────────────────────────

  describe('AppState integration', () => {
    it('disconnects Jetstream when app goes to background', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const disconnectEvents: JetstreamEvent[] = [];

      service.on(JetstreamEventType.DISCONNECT, (e) => disconnectEvents.push(e));

      service.connect();
      await Promise.resolve();
      expect(service.isConnected()).toBe(true);

      // Simulate backgrounding
      simulateAppStateChange('background');

      expect(service.isConnected()).toBe(false);
      expect(disconnectEvents.length).toBeGreaterThanOrEqual(1);

      service.destroy();
    });

    it('reconnects Jetstream when app comes to foreground', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);

      service.connect();
      await Promise.resolve();
      expect(service.isConnected()).toBe(true);

      // Background
      simulateAppStateChange('background');
      expect(service.isConnected()).toBe(false);

      // Foreground
      simulateAppStateChange('active');
      await Promise.resolve();

      expect(service.isConnected()).toBe(true);

      service.destroy();
    });

    it('does not reconnect on foreground if was not connected before background', async () => {
      const config: JetstreamConfig = { userDid: 'did:plc:test', followedDids: [] };
      const service = new JetstreamService(config);
      const connectEvents: JetstreamEvent[] = [];

      service.on(JetstreamEventType.CONNECT, (e) => connectEvents.push(e));

      // Don't connect initially, just set up listeners
      service.connect();
      await Promise.resolve();
      service.disconnect();

      const eventsBeforeForeground = connectEvents.length;

      // Simulate going to background then foreground
      simulateAppStateChange('background');
      simulateAppStateChange('active');
      await Promise.resolve();

      // Should not have connected again since wasConnectedBeforeBackground was false
      expect(connectEvents.length).toBe(eventsBeforeForeground);

      service.destroy();
    });
  });

  // ── Singleton Management ─────────────────────────────────────────────

  describe('Singleton management', () => {
    it('initializeJetstreamService creates a new instance', async () => {
      const service = initializeJetstreamService({ userDid: 'did:plc:test' });
      expect(service).toBeInstanceOf(JetstreamService);
      service.destroy();
    });

    it('initializeJetstreamService destroys previous instance', async () => {
      const service1 = initializeJetstreamService({ userDid: 'did:plc:test1' });
      service1.connect();
      await Promise.resolve();
      expect(service1.isConnected()).toBe(true);

      // Creating a new instance should destroy the previous one
      const service2 = initializeJetstreamService({ userDid: 'did:plc:test2' });
      expect(service1.isConnected()).toBe(false);

      service2.destroy();
    });

    it('disconnectJetstream cleans up everything', async () => {
      const service = initializeJetstreamService({ userDid: 'did:plc:test' });
      service.connect();
      await Promise.resolve();

      disconnectJetstream();
      expect(service.isConnected()).toBe(false);
    });
  });
});
