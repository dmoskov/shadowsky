import * as Notifications from 'expo-notifications';

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

// Mock setBadgeCountAsync (not in jest.setup)
(Notifications as any).setBadgeCountAsync = jest.fn().mockResolvedValue(true);
(Notifications as any).DEFAULT_ACTION_IDENTIFIER =
  Notifications.DEFAULT_ACTION_IDENTIFIER || 'expo.modules.notifications.actions.DEFAULT';

// Track the response listener callback
let responseListenerCallback: ((r: any) => void) | null = null;

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => mockRouter),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  Stack: {Screen: 'Screen'},
}));

(Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation(
  () => ({remove: jest.fn()}),
);

(
  Notifications.addNotificationResponseReceivedListener as jest.Mock
).mockImplementation((cb: any) => {
  responseListenerCallback = cb;
  return {remove: jest.fn()};
});

// ─── Import after mocks ───────────────────────────────────

import {renderHook, act} from '@testing-library/react-native';
import {useNotificationHandler} from '../../hooks/useNotificationHandler';
import {handleNotificationAction} from '../../services/notification-categories';

// ─── Helpers ──────────────────────────────────────────────

function makeNotificationResponse(data: Record<string, any> | undefined) {
  return {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: {
      request: {
        content: {
          data,
        },
      },
    },
  };
}

async function tapNotification(data: Record<string, any> | undefined) {
  const response = makeNotificationResponse(data);
  await act(async () => {
    await responseListenerCallback!(response);
  });
}

// ─── Tests ────────────────────────────────────────────────

describe('Notification Navigation (tap-to-open)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    responseListenerCallback = null;

    (handleNotificationAction as jest.Mock).mockResolvedValue(false);

    (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mockImplementation((cb: any) => {
      responseListenerCallback = cb;
      return {remove: jest.fn()};
    });

    (Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation(
      () => ({remove: jest.fn()}),
    );

    renderHook(() => useNotificationHandler());
  });

  // ── Post / Thread Notifications ───────────────────────

  describe('Post/Thread notifications', () => {
    it('tap like notification → opens liked post thread', async () => {
      await tapNotification({type: 'post', postId: 'abc123'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/(home)/thread/abc123');
    });

    it('tap reply notification → opens thread at reply', async () => {
      await tapNotification({type: 'thread', postId: 'reply456'});

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/reply456',
      );
    });

    it('tap post notification without postId → falls back to notifications tab', async () => {
      await tapNotification({type: 'post'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('tap thread notification without postId → falls back to notifications tab', async () => {
      await tapNotification({type: 'thread'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('tap reply notification with focusUri → passes focusUri as query param', async () => {
      await tapNotification({
        type: 'thread',
        postId: 'thread123',
        focusUri: 'at://did:plc:abc/app.bsky.feed.post/reply456',
      });

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/thread123?focusUri=at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2Freply456',
      );
    });

    it('tap notification with handle and focusUri → passes both query params', async () => {
      await tapNotification({
        type: 'post',
        postId: 'p1',
        handle: 'alice.bsky.social',
        focusUri: 'at://did:plc:abc/app.bsky.feed.post/r1',
      });

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/p1?handle=alice.bsky.social&focusUri=at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2Fr1',
      );
    });

    it('tap notification with handle only → passes handle query param', async () => {
      await tapNotification({
        type: 'post',
        postId: 'p2',
        handle: 'bob.bsky.social',
      });

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/p2?handle=bob.bsky.social',
      );
    });
  });

  // ── Profile / Follow Notifications ────────────────────

  describe('Profile/Follow notifications', () => {
    it('tap follow notification → opens follower profile', async () => {
      await tapNotification({type: 'profile', handle: 'alice.bsky.social'});

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/profile/alice.bsky.social',
      );
    });

    it('tap profile notification with custom domain handle', async () => {
      await tapNotification({type: 'profile', handle: 'bob.example.com'});

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/profile/bob.example.com',
      );
    });

    it('tap profile notification without handle → falls back to notifications tab', async () => {
      await tapNotification({type: 'profile'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });
  });

  // ── DM / Message Notifications ────────────────────────

  describe('DM/Message notifications', () => {
    it('tap DM notification → opens messages screen', async () => {
      await tapNotification({type: 'dm'});

      expect(mockPush).toHaveBeenCalledWith('/(app)/profile/messages');
    });

    it('tap message notification → opens messages screen', async () => {
      await tapNotification({type: 'message'});

      expect(mockPush).toHaveBeenCalledWith('/(app)/profile/messages');
    });
  });

  // ── Generic / Default Notifications ───────────────────

  describe('Generic notifications', () => {
    it('tap generic notification → opens notifications tab', async () => {
      await tapNotification({type: 'notification'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('notification with no data → opens notifications tab', async () => {
      await tapNotification(undefined);

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('notification with unknown type → opens notifications tab', async () => {
      await tapNotification({type: 'new_feature_type'});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });
  });

  // ── Edge Cases ────────────────────────────────────────

  describe('Edge cases', () => {
    it('notification with empty data object → defaults to notifications tab', async () => {
      await tapNotification({});

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/notifications');
    });

    it('notification for deleted post (has postId but post may not exist) navigates correctly', async () => {
      // The navigation layer doesn't know if a post is deleted — it just navigates.
      // The thread screen itself handles the 404.
      await tapNotification({type: 'post', postId: 'deleted-post-id'});

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/thread/deleted-post-id',
      );
    });

    it('notification with special characters in handle navigates correctly', async () => {
      await tapNotification({
        type: 'profile',
        handle: 'user-with.special_chars.bsky.social',
      });

      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/profile/user-with.special_chars.bsky.social',
      );
    });

    it('notification with extra unknown fields does not crash', async () => {
      await tapNotification({
        type: 'post',
        postId: 'abc',
        unknownField: 'value',
        nested: {deep: true},
      });

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/(home)/thread/abc');
    });

    it('action button handled by notification-categories skips navigation', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(true);

      const response = {
        actionIdentifier: 'LIKE_ACTION',
        notification: {
          request: {
            content: {
              data: {type: 'post', postId: 'liked-post'},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      // Navigation should NOT happen when action is handled
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('action button that fails to handle falls through to navigation', async () => {
      (handleNotificationAction as jest.Mock).mockResolvedValue(false);

      const response = {
        actionIdentifier: 'LIKE_ACTION',
        notification: {
          request: {
            content: {
              data: {type: 'profile', handle: 'user.bsky.social'},
            },
          },
        },
      };

      await act(async () => {
        await responseListenerCallback!(response);
      });

      // Action wasn't handled, so navigation should proceed
      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/(home)/profile/user.bsky.social',
      );
    });

    it('multiple notification types navigated in sequence use correct routes', async () => {
      const types = [
        {data: {type: 'post', postId: 'p1'}, route: '/(tabs)/(home)/thread/p1'},
        {
          data: {type: 'profile', handle: 'h1'},
          route: '/(tabs)/(home)/profile/h1',
        },
        {data: {type: 'dm'}, route: '/(app)/profile/messages'},
        {data: {type: 'notification'}, route: '/(tabs)/notifications'},
      ];

      for (const {data, route} of types) {
        mockPush.mockClear();
        await tapNotification(data);
        expect(mockPush).toHaveBeenCalledWith(route);
      }
    });
  });
});
