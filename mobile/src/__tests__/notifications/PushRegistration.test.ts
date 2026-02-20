import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Mocks ─────────────────────────────────────────────────

// Must mock before import
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Override expo-constants with eas.projectId for push token tests
jest.mock('expo-constants', () => {
  const obj = {
    expoConfig: {
      extra: {eas: {projectId: 'test-project-id'}},
    },
    deviceId: 'test-device',
  };
  return {
    ...obj,
    __esModule: true,
    default: obj,
  };
});

// Override expo-notifications to include getExpoPushTokenAsync
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  setBadgeCountAsync: jest.fn(),
}));

const mockGetPermissionsAsync =
  Notifications.getPermissionsAsync as jest.MockedFunction<
    typeof Notifications.getPermissionsAsync
  >;
const mockRequestPermissionsAsync =
  Notifications.requestPermissionsAsync as jest.MockedFunction<
    typeof Notifications.requestPermissionsAsync
  >;
const mockGetExpoPushTokenAsync =
  Notifications.getExpoPushTokenAsync as jest.MockedFunction<
    typeof Notifications.getExpoPushTokenAsync
  >;

// ─── Import after mocks ───────────────────────────────────
import {
  registerForPushNotifications,
  savePushTokenToATProto,
  getPushTokenFromATProto,
  shouldUpdatePushToken,
  initializePushNotifications,
  unregisterPushNotifications,
} from '../../services/push-notification-service';

// ─── Helpers ──────────────────────────────────────────────

function makeAgent(overrides: Record<string, any> = {}) {
  return {
    session: {did: 'did:plc:test123'},
    com: {
      atproto: {
        repo: {
          putRecord: jest.fn().mockResolvedValue({}),
          getRecord: jest.fn().mockResolvedValue({
            data: {
              value: {
                token: 'ExponentPushToken[abc123]',
                platform: 'ios',
                deviceId: 'test-device',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            },
          }),
          deleteRecord: jest.fn().mockResolvedValue({}),
        },
      },
    },
    ...overrides,
  } as any;
}

// ─── Tests ────────────────────────────────────────────────

describe('Push Notification Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: physical device with project ID
    (Device as any).isDevice = true;
    // Reset Constants to default test values
    Object.assign(Constants, {
      expoConfig: {
        extra: {eas: {projectId: 'test-project-id'}},
      },
      deviceId: 'test-device',
    });
  });

  // ── registerForPushNotifications ──────────────────────

  describe('registerForPushNotifications', () => {
    it('returns null on non-physical device (simulator)', async () => {
      (Device as any).isDevice = false;

      const result = await registerForPushNotifications();

      expect(result).toBeNull();
      expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests permission when not already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[abc123]',
        type: 'expo',
      });

      const result = await registerForPushNotifications();

      expect(mockRequestPermissionsAsync).toHaveBeenCalledWith({
        ios: {allowAlert: true, allowBadge: true, allowSound: true},
      });
      expect(result).toBe('ExponentPushToken[abc123]');
    });

    it('skips permission request when already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[abc123]',
        type: 'expo',
      });

      const result = await registerForPushNotifications();

      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
      expect(result).toBe('ExponentPushToken[abc123]');
    });

    it('returns null when permission is denied', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      } as any);

      const result = await registerForPushNotifications();

      expect(result).toBeNull();
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('returns null when project ID is not configured', async () => {
      Object.assign(Constants, {expoConfig: {extra: {}}});
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);

      const result = await registerForPushNotifications();

      expect(result).toBeNull();
    });

    it('saves token to AsyncStorage on success', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xyz789]',
        type: 'expo',
      });

      await registerForPushNotifications();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/push_token',
        'ExponentPushToken[xyz789]',
      );
    });

    it('returns null and does not throw on unexpected error', async () => {
      mockGetPermissionsAsync.mockRejectedValue(
        new Error('Native module error'),
      );

      const result = await registerForPushNotifications();

      expect(result).toBeNull();
    });
  });

  // ── savePushTokenToATProto ────────────────────────────

  describe('savePushTokenToATProto', () => {
    it('saves token record to AT Protocol with correct shape', async () => {
      const agent = makeAgent();

      const result = await savePushTokenToATProto(
        agent,
        'ExponentPushToken[abc123]',
      );

      expect(result).toBe(true);
      expect(agent.com.atproto.repo.putRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: 'did:plc:test123',
          collection: 'com.shadowsky.pushToken',
          rkey: 'self',
          record: expect.objectContaining({
            token: 'ExponentPushToken[abc123]',
            platform: expect.any(String),
            deviceId: 'test-device',
            updatedAt: expect.any(String),
          }),
        }),
      );
    });

    it('returns false when ATProto save fails', async () => {
      const agent = makeAgent();
      agent.com.atproto.repo.putRecord.mockRejectedValue(
        new Error('ATProto error'),
      );

      const result = await savePushTokenToATProto(
        agent,
        'ExponentPushToken[abc123]',
      );

      expect(result).toBe(false);
    });
  });

  // ── getPushTokenFromATProto ───────────────────────────

  describe('getPushTokenFromATProto', () => {
    it('returns the stored push token record', async () => {
      const agent = makeAgent();

      const result = await getPushTokenFromATProto(agent);

      expect(result).toEqual({
        token: 'ExponentPushToken[abc123]',
        platform: 'ios',
        deviceId: 'test-device',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('returns null when record does not exist (400 error)', async () => {
      const agent = makeAgent();
      const notFoundError = Object.assign(new Error('Not found'), {
        status: 400,
      });
      agent.com.atproto.repo.getRecord.mockRejectedValue(notFoundError);

      const result = await getPushTokenFromATProto(agent);

      expect(result).toBeNull();
    });

    it('returns null on non-400 error', async () => {
      const agent = makeAgent();
      agent.com.atproto.repo.getRecord.mockRejectedValue(
        new Error('Server error'),
      );

      const result = await getPushTokenFromATProto(agent);

      expect(result).toBeNull();
    });
  });

  // ── shouldUpdatePushToken ─────────────────────────────

  describe('shouldUpdatePushToken', () => {
    it('returns true when no record exists', async () => {
      const agent = makeAgent();
      const notFoundError = Object.assign(new Error('Not found'), {
        status: 400,
      });
      agent.com.atproto.repo.getRecord.mockRejectedValue(notFoundError);

      const result = await shouldUpdatePushToken(
        agent,
        'ExponentPushToken[abc123]',
      );

      expect(result).toBe(true);
    });

    it('returns true when token has changed', async () => {
      const agent = makeAgent();
      // Stored token is ExponentPushToken[abc123], check with different token
      const result = await shouldUpdatePushToken(
        agent,
        'ExponentPushToken[newtoken]',
      );

      expect(result).toBe(true);
    });

    it('returns true when device ID has changed', async () => {
      const agent = makeAgent();
      // Stored deviceId is 'test-device', change current
      Object.assign(Constants, {deviceId: 'different-device'});

      const result = await shouldUpdatePushToken(
        agent,
        'ExponentPushToken[abc123]',
      );

      expect(result).toBe(true);
    });

    it('returns false when token and device match', async () => {
      const agent = makeAgent();
      // Stored: token=ExponentPushToken[abc123], deviceId=test-device
      Object.assign(Constants, {deviceId: 'test-device'});

      const result = await shouldUpdatePushToken(
        agent,
        'ExponentPushToken[abc123]',
      );

      expect(result).toBe(false);
    });
  });

  // ── initializePushNotifications ───────────────────────

  describe('initializePushNotifications', () => {
    it('registers token and saves to ATProto when update needed', async () => {
      const agent = makeAgent();
      // No existing record → needs update
      const notFoundError = Object.assign(new Error('Not found'), {
        status: 400,
      });
      agent.com.atproto.repo.getRecord.mockRejectedValue(notFoundError);

      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[fresh]',
        type: 'expo',
      });

      const result = await initializePushNotifications(agent);

      expect(result).toBe(true);
      expect(agent.com.atproto.repo.putRecord).toHaveBeenCalled();
    });

    it('skips ATProto save when token has not changed', async () => {
      const agent = makeAgent();
      // Stored record matches current token and device
      Object.assign(Constants, {deviceId: 'test-device'});

      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[abc123]',
        type: 'expo',
      });

      const result = await initializePushNotifications(agent);

      expect(result).toBe(true);
      expect(agent.com.atproto.repo.putRecord).not.toHaveBeenCalled();
    });

    it('returns false when registration fails (no token)', async () => {
      const agent = makeAgent();
      // No permission
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      } as any);
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      } as any);

      const result = await initializePushNotifications(agent);

      expect(result).toBe(false);
    });

    it('returns false when ATProto save fails', async () => {
      const agent = makeAgent();
      const notFoundError = Object.assign(new Error('Not found'), {
        status: 400,
      });
      agent.com.atproto.repo.getRecord.mockRejectedValue(notFoundError);
      agent.com.atproto.repo.putRecord.mockRejectedValue(
        new Error('Network error'),
      );

      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);
      mockGetExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[abc123]',
        type: 'expo',
      });

      const result = await initializePushNotifications(agent);

      expect(result).toBe(false);
    });
  });

  // ── unregisterPushNotifications ───────────────────────

  describe('unregisterPushNotifications', () => {
    it('deletes ATProto record and clears local storage', async () => {
      const agent = makeAgent();

      await unregisterPushNotifications(agent);

      expect(agent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'com.shadowsky.pushToken',
        rkey: 'self',
      });
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@shadowsky/push_token',
      );
    });

    it('does not throw when ATProto delete fails', async () => {
      const agent = makeAgent();
      agent.com.atproto.repo.deleteRecord.mockRejectedValue(
        new Error('Network error'),
      );

      // Should not throw
      await expect(
        unregisterPushNotifications(agent),
      ).resolves.toBeUndefined();
    });
  });
});
