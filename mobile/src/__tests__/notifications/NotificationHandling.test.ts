import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {renderHook, act, waitFor} from '@testing-library/react-native';

// ─── Mocks ─────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('../../services/notification-categories', () => ({
  handleNotificationAction: jest.fn().mockResolvedValue(false),
  registerNotificationCategories: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/badge', () => ({
  clearBadgeCount: jest.fn().mockResolvedValue(undefined),
  updateBadgeCount: jest.fn().mockResolvedValue(undefined),
}));

// Override expo-notifications mock to include all APIs we test
const mockReceivedRemove = jest.fn();
const mockResponseRemove = jest.fn();

let receivedListenerCallback: ((n: any) => void) | null = null;
let responseListenerCallback: ((r: any) => void) | null = null;

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationCategoryAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  setBadgeCountAsync: jest.fn().mockResolvedValue(true),
  AndroidImportance: {MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1},
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

const mockPush = jest.fn();
const mockRouter = {push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true)};

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => mockRouter),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  Stack: {Screen: 'Screen'},
}));

// ─── Import after mocks ───────────────────────────────────

import {useNotificationHandler} from '../../hooks/useNotificationHandler';
import {
  useNotificationPermissions,
  configureNotificationHandler,
} from '../../hooks/useNotificationPermissions';
import {handleNotificationAction} from '../../services/notification-categories';
import {clearBadgeCount} from '../../utils/badge';

const mockSetNotificationHandler =
  Notifications.setNotificationHandler as jest.MockedFunction<
    typeof Notifications.setNotificationHandler
  >;
const mockGetPermissionsAsync =
  Notifications.getPermissionsAsync as jest.MockedFunction<
    typeof Notifications.getPermissionsAsync
  >;
const mockRequestPermissionsAsync =
  Notifications.requestPermissionsAsync as jest.MockedFunction<
    typeof Notifications.requestPermissionsAsync
  >;

// ─── Tests ────────────────────────────────────────────────

describe('Notification Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    receivedListenerCallback = null;
    responseListenerCallback = null;
    (Device as any).isDevice = true;

    // Re-setup listener capture after clearAllMocks
    (
      Notifications.addNotificationReceivedListener as jest.Mock
    ).mockImplementation((cb: any) => {
      receivedListenerCallback = cb;
      return {remove: mockReceivedRemove};
    });
    (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mockImplementation((cb: any) => {
      responseListenerCallback = cb;
      return {remove: mockResponseRemove};
    });
  });

  // ── configureNotificationHandler ──────────────────────

  describe('configureNotificationHandler', () => {
    it('sets up Notifications.setNotificationHandler with correct config', () => {
      configureNotificationHandler();

      expect(mockSetNotificationHandler).toHaveBeenCalledWith({
        handleNotification: expect.any(Function),
      });
    });

    it('handler returns shouldShowAlert, shouldPlaySound, shouldSetBadge as true', async () => {
      configureNotificationHandler();

      const handlerArg = mockSetNotificationHandler.mock.calls[0][0];
      const result = await handlerArg!.handleNotification(
        {} as Notifications.Notification,
      );

      expect(result).toEqual(
        expect.objectContaining({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      );
    });

    it('sets up Android notification channel on Android', () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', {value: 'android', writable: true});

      configureNotificationHandler();

      expect(
        (Notifications as any).setNotificationChannelAsync,
      ).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'Default',
          importance: 5, // AndroidImportance.MAX
        }),
      );

      Object.defineProperty(Platform, 'OS', {value: originalOS, writable: true});
    });
  });

  // ── useNotificationHandler ────────────────────────────

  describe('useNotificationHandler', () => {
    it('registers both foreground and response listeners on mount', () => {
      renderHook(() => useNotificationHandler());

      expect(
        Notifications.addNotificationReceivedListener,
      ).toHaveBeenCalledWith(expect.any(Function));
      expect(
        Notifications.addNotificationResponseReceivedListener,
      ).toHaveBeenCalledWith(expect.any(Function));
    });

    it('cleans up listeners on unmount', () => {
      const {unmount} = renderHook(() => useNotificationHandler());

      unmount();

      expect(mockReceivedRemove).toHaveBeenCalled();
      expect(mockResponseRemove).toHaveBeenCalled();
    });

    it('foreground received listener does not throw', () => {
      renderHook(() => useNotificationHandler());

      expect(receivedListenerCallback).not.toBeNull();
      // Should not throw when receiving a foreground notification
      expect(() =>
        receivedListenerCallback!({
          date: Date.now(),
          request: {
            identifier: 'test-id',
            content: {title: 'Test', body: 'Test body', data: {}},
          },
        }),
      ).not.toThrow();
    });

    it('delegates to handleNotificationAction for action button presses', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(true);

      renderHook(() => useNotificationHandler());

      const response = {
        actionIdentifier: 'LIKE_ACTION',
        notification: {
          request: {
            content: {
              data: {type: 'post', postId: 'abc123', postUri: 'at://did/post/1'},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      expect(handleNotificationAction).toHaveBeenCalledWith(response);
      // Action was handled, so no navigation
      expect(mockPush).not.toHaveBeenCalled();
      expect(clearBadgeCount).toHaveBeenCalled();
    });

    it('navigates when handleNotificationAction returns false (default tap)', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      renderHook(() => useNotificationHandler());

      const response = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {type: 'post', postId: 'post123'},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/post123',
      );
      expect(clearBadgeCount).toHaveBeenCalled();
    });

    it('clears badge count on any notification interaction', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      renderHook(() => useNotificationHandler());

      const response = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {type: 'notification'},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      expect(clearBadgeCount).toHaveBeenCalled();
    });
  });

  // ── useNotificationPermissions ────────────────────────

  describe('useNotificationPermissions', () => {
    it('checks permission status on mount', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);

      const {result} = renderHook(() => useNotificationPermissions());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
        expect(result.current.permissionStatus).toBe('granted');
      });
    });

    it('reports denied permission correctly', async () => {
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      } as any);

      const {result} = renderHook(() => useNotificationPermissions());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.permissionStatus).toBe('denied');
      });
    });

    it('reports undetermined on simulator', async () => {
      (Device as any).isDevice = false;

      const {result} = renderHook(() => useNotificationPermissions());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.permissionStatus).toBe('undetermined');
      });
    });

    it('tracks hasAskedBefore from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as any);

      const {result} = renderHook(() => useNotificationPermissions());

      await waitFor(() => {
        expect(result.current.hasAskedBefore).toBe(true);
      });
    });

    it('requestPermission marks asked and requests iOS permissions', async () => {
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

      const {result} = renderHook(() => useNotificationPermissions());

      let granted: boolean = false;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/notification_permission_asked',
        'true',
      );
      expect(mockRequestPermissionsAsync).toHaveBeenCalledWith({
        ios: {allowAlert: true, allowBadge: true, allowSound: true},
      });
    });

    it('requestPermission returns false when denied', async () => {
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

      const {result} = renderHook(() => useNotificationPermissions());

      let granted: boolean = true;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
    });

    it('requestPermission returns false on simulator', async () => {
      (Device as any).isDevice = false;

      const {result} = renderHook(() => useNotificationPermissions());

      let granted: boolean = true;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles notification with no data gracefully', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      renderHook(() => useNotificationHandler());

      const response = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: undefined,
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      // Should default to notifications tab
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('handles malformed notification payload without crashing', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      renderHook(() => useNotificationHandler());

      const response = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {type: 'unknown_type', weirdField: 42},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      // Unknown type falls through to default → notifications tab
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('handles rapid successive notification responses without crashing', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      renderHook(() => useNotificationHandler());

      const makeResponse = (type: string, id: string) => ({
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {type, postId: id},
            },
          },
        },
      });

      // Fire multiple responses rapidly
      await act(async () => {
        await Promise.all([
          responseListenerCallback!(makeResponse('post', '1')),
          responseListenerCallback!(makeResponse('post', '2')),
          responseListenerCallback!(makeResponse('profile', 'user.bsky.social')),
        ]);
      });

      // All three navigations should have been attempted
      expect(mockPush).toHaveBeenCalledTimes(3);
      expect(clearBadgeCount).toHaveBeenCalledTimes(3);
    });
  });
});
