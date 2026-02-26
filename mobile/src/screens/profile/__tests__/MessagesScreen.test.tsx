import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

// Force non-native path in tests by overriding Platform.OS to 'android'
// before the MessagesScreen module evaluates its top-level constant.
// We use jest.mock with a factory that runs before imports are resolved.
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  return {
    __esModule: true,
    default: { ...actual.default, OS: 'android', select: (obj: any) => obj.android ?? obj.default },
  };
});

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ session: { did: 'did:plc:myself' } }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: mockRouterReplace,
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({ navigateToProfile: jest.fn() }),
}));

jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({ log: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));

jest.mock('../../../services/dm-service', () => ({
  dmService: { setAgent: jest.fn(), getConvoForMembers: jest.fn() },
  DmConversation: {},
  DmMessage: {},
}));

jest.mock('../../../services/atproto/client', () => ({
  getAtProtoClient: () => ({ getAgent: jest.fn() }),
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago'),
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => <View>{props.children}</View> };
});

// Mock all icon components
jest.mock('../../../components/icons', () => ({
  LockIcon: () => null,
  ChatBubbleIcon: () => null,
  ArrowLeftIcon: () => null,
  SearchIcon: () => null,
  CloseIcon: () => null,
  PlusIcon: () => null,
  TrashIcon: () => null,
  BellIcon: () => null,
  BellSlashIcon: () => null,
}));

jest.mock('../../../components/LoadingState', () => ({
  LoadingState: () => {
    const { View } = require('react-native');
    return <View testID="loading-state" />;
  },
}));

jest.mock('../../../components/ErrorState', () => ({
  ErrorState: ({ message, onRetry }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="error-state">
        <Text testID="error-message">{message}</Text>
        {onRetry && (
          <TouchableOpacity testID="retry-button" onPress={onRetry}>
            <Text>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

jest.mock('../../../components/EmptyState', () => ({
  EmptyState: ({ message }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="empty-state">
        <Text>{message}</Text>
      </View>
    );
  },
}));

jest.mock('../../../components/NewConversationModal', () => ({
  NewConversationModal: () => null,
}));

jest.mock('../../../components/SkeletonShimmer', () => ({
  SkeletonShimmer: () => {
    const { View } = require('react-native');
    return <View testID="skeleton-shimmer" />;
  },
}));

jest.mock('../../../components/ui/InlineErrorBoundary', () => ({
  InlineErrorBoundary: ({ children }: any) => children,
}));

// ─── Controllable hook state ───────────────────────────────

let mockConversations: any[] | undefined = undefined;
let mockLoadingConversations = true;
let mockConversationsError: any = null;
const mockRefetchConversations = jest.fn();

let mockConversationData: any = null;
let mockLoadingMessages = false;
const mockRefetchMessages = jest.fn();

const mockSendMessage = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
const mockMarkAsRead = { mutate: jest.fn() };
const mockMuteConversation = { mutateAsync: jest.fn() };
const mockUnmuteConversation = { mutateAsync: jest.fn() };
const mockLeaveConversation = { mutateAsync: jest.fn() };
const mockDeleteMessage = { mutateAsync: jest.fn() };

jest.mock('../../../hooks/api', () => ({
  useConversations: () => ({
    data: mockConversations,
    isLoading: mockLoadingConversations,
    error: mockConversationsError,
    refetch: mockRefetchConversations,
  }),
  useConversation: () => ({
    data: mockConversationData,
    isLoading: mockLoadingMessages,
    refetch: mockRefetchMessages,
  }),
  useSendMessage: () => mockSendMessage,
  useMarkAsRead: () => mockMarkAsRead,
  useMuteConversation: () => mockMuteConversation,
  useUnmuteConversation: () => mockUnmuteConversation,
  useLeaveConversation: () => mockLeaveConversation,
  useDeleteMessage: () => mockDeleteMessage,
}));

// ─── Import after mocks ───────────────────────────────────

import { MessagesScreen } from '../MessagesScreen';

// ─── Factory helpers ──────────────────────────────────────

function makeConversation(id: string, otherHandle: string) {
  return {
    id,
    members: [
      { did: 'did:plc:myself', handle: 'myself.bsky.social', displayName: 'Me' },
      {
        did: `did:plc:${otherHandle}`,
        handle: `${otherHandle}.bsky.social`,
        displayName: otherHandle.charAt(0).toUpperCase() + otherHandle.slice(1),
        avatar: `https://example.com/${otherHandle}.jpg`,
      },
    ],
    lastMessage: { text: `Last message from ${otherHandle}`, sentAt: '2025-01-01T00:00:00Z' },
    unreadCount: 0,
    muted: false,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('MessagesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConversations = undefined;
    mockLoadingConversations = true;
    mockConversationsError = null;
    mockConversationData = null;
    mockLoadingMessages = false;
  });

  // ─── Loading state ──────────────────────────────────────

  describe('loading state', () => {
    it('shows skeleton shimmer items while conversations are loading', () => {
      const { getAllByTestId } = render(<MessagesScreen />);

      const skeletons = getAllByTestId('skeleton-shimmer');
      // The loading state renders 5 skeleton rows, each with multiple SkeletonShimmer
      // components (avatar + name + message line), so we expect at least 5
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });

    it('shows the Messages header title during loading', () => {
      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Messages')).toBeTruthy();
    });

    it('does not show error or empty state while loading', () => {
      const { queryByTestId, queryByText } = render(<MessagesScreen />);

      expect(queryByTestId('error-state')).toBeNull();
      expect(queryByTestId('empty-state')).toBeNull();
      expect(queryByText('No conversations yet')).toBeNull();
    });
  });

  // ─── Error state - generic ─────────────────────────────

  describe('generic error state', () => {
    it('shows ErrorState with the error message', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('Network failure');

      const { getByTestId } = render(<MessagesScreen />);

      expect(getByTestId('error-state')).toBeTruthy();
      expect(getByTestId('error-message').props.children).toBe('Network failure');
    });

    it('renders a retry button for generic errors', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('Something went wrong');

      const { getByTestId } = render(<MessagesScreen />);

      expect(getByTestId('retry-button')).toBeTruthy();
    });

    it('calls refetch when the retry button is pressed', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('Timeout');

      const { getByTestId } = render(<MessagesScreen />);

      fireEvent.press(getByTestId('retry-button'));

      expect(mockRefetchConversations).toHaveBeenCalledTimes(1);
    });

    it('uses fallback message for non-Error objects', () => {
      mockLoadingConversations = false;
      mockConversationsError = 'plain string error';

      const { getByTestId } = render(<MessagesScreen />);

      expect(getByTestId('error-message').props.children).toBe(
        'Failed to load conversations'
      );
    });
  });

  // ─── Error state - permission (403) ────────────────────

  describe('permission error state', () => {
    it('shows "App Password Required" for permission errors', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('permission denied');

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('App Password Required')).toBeTruthy();
    });

    it('shows "App Password Required" for 403 errors', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('Request failed with status 403');

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('App Password Required')).toBeTruthy();
    });

    it('shows instructions for enabling DMs on permission error', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('403 forbidden');

      const { getByText } = render(<MessagesScreen />);

      expect(
        getByText(/Direct Messages require an app password with chat permissions/)
      ).toBeTruthy();
    });

    it('does not show ErrorState component for permission errors', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('permission error');

      const { queryByTestId } = render(<MessagesScreen />);

      expect(queryByTestId('error-state')).toBeNull();
    });
  });

  // ─── Empty state ───────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when conversations array is empty', () => {
      mockLoadingConversations = false;
      mockConversations = [];

      const { getByTestId } = render(<MessagesScreen />);

      expect(getByTestId('empty-state')).toBeTruthy();
    });

    it('shows the expected empty message', () => {
      mockLoadingConversations = false;
      mockConversations = [];

      const { getByText } = render(<MessagesScreen />);

      expect(
        getByText('No conversations yet. Tap + to start a new conversation!')
      ).toBeTruthy();
    });

    it('shows empty state when conversations is undefined and not loading', () => {
      mockLoadingConversations = false;
      mockConversations = undefined;

      const { getByTestId } = render(<MessagesScreen />);

      expect(getByTestId('empty-state')).toBeTruthy();
    });

    it('shows Messages header in empty state', () => {
      mockLoadingConversations = false;
      mockConversations = [];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Messages')).toBeTruthy();
    });
  });

  // ─── Conversation list rendering ───────────────────────

  describe('conversation list rendering', () => {
    it('renders conversation display names', () => {
      mockLoadingConversations = false;
      mockConversations = [
        makeConversation('convo-1', 'alice'),
        makeConversation('convo-2', 'bob'),
      ];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });

    it('renders conversation handles with @ prefix', () => {
      mockLoadingConversations = false;
      mockConversations = [makeConversation('convo-1', 'alice')];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('@alice.bsky.social')).toBeTruthy();
    });

    it('renders last message text for each conversation', () => {
      mockLoadingConversations = false;
      mockConversations = [
        makeConversation('convo-1', 'alice'),
        makeConversation('convo-2', 'bob'),
      ];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Last message from alice')).toBeTruthy();
      expect(getByText('Last message from bob')).toBeTruthy();
    });

    it('renders unread badge when unreadCount > 0', () => {
      mockLoadingConversations = false;
      mockConversations = [
        { ...makeConversation('convo-1', 'alice'), unreadCount: 3 },
      ];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('3')).toBeTruthy();
    });

    it('does not render unread badge when unreadCount is 0', () => {
      mockLoadingConversations = false;
      mockConversations = [
        { ...makeConversation('convo-1', 'alice'), unreadCount: 0 },
      ];

      const { queryByText } = render(<MessagesScreen />);

      // The badge text "0" should not be rendered (badge is hidden when count is 0)
      // We check that no element with just "0" as text content exists in the badge context
      // Since unreadCount > 0 is the condition, the badge View is not rendered at all
      const zeroTexts = queryByText('0');
      expect(zeroTexts).toBeNull();
    });

    it('renders multiple conversations in the list', () => {
      mockLoadingConversations = false;
      mockConversations = [
        makeConversation('convo-1', 'alice'),
        makeConversation('convo-2', 'bob'),
        makeConversation('convo-3', 'carol'),
      ];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
      expect(getByText('Carol')).toBeTruthy();
    });

    it('renders the Messages header with conversation list', () => {
      mockLoadingConversations = false;
      mockConversations = [makeConversation('convo-1', 'alice')];

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Messages')).toBeTruthy();
    });
  });

  // ─── Render stability ─────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing during loading state', () => {
      mockLoadingConversations = true;

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders without crashing with empty conversations', () => {
      mockLoadingConversations = false;
      mockConversations = [];

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders without crashing with generic error', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('fail');

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders without crashing with permission error', () => {
      mockLoadingConversations = false;
      mockConversationsError = new Error('403 forbidden');

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders without crashing with populated conversation list', () => {
      mockLoadingConversations = false;
      mockConversations = [
        makeConversation('convo-1', 'alice'),
        makeConversation('convo-2', 'bob'),
      ];

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('handles multiple re-renders without crashing', () => {
      mockLoadingConversations = false;
      mockConversations = [makeConversation('convo-1', 'alice')];

      const { rerender } = render(<MessagesScreen />);

      expect(() => {
        rerender(<MessagesScreen />);
        rerender(<MessagesScreen />);
      }).not.toThrow();
    });

    it('transitions from loading to loaded without crashing', () => {
      mockLoadingConversations = true;

      const { getAllByTestId, rerender, getByText, queryByTestId } = render(
        <MessagesScreen />
      );

      expect(getAllByTestId('skeleton-shimmer').length).toBeGreaterThanOrEqual(5);

      // Transition to loaded state
      mockLoadingConversations = false;
      mockConversations = [makeConversation('convo-1', 'alice')];

      rerender(<MessagesScreen />);

      expect(queryByTestId('skeleton-shimmer')).toBeNull();
      expect(getByText('Alice')).toBeTruthy();
    });

    it('transitions from loading to error without crashing', () => {
      mockLoadingConversations = true;

      const { rerender, getByTestId } = render(<MessagesScreen />);

      // Transition to error state
      mockLoadingConversations = false;
      mockConversationsError = new Error('Server error');

      rerender(<MessagesScreen />);

      expect(getByTestId('error-state')).toBeTruthy();
    });

    it('renders without crashing when conversations is undefined and not loading', () => {
      mockLoadingConversations = false;
      mockConversations = undefined;

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders conversation without avatar gracefully', () => {
      mockLoadingConversations = false;
      const convo = makeConversation('convo-1', 'alice');
      convo.members[1].avatar = '';
      mockConversations = [convo];

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });

    it('renders conversation without last message gracefully', () => {
      mockLoadingConversations = false;
      const convo = makeConversation('convo-1', 'alice');
      (convo as any).lastMessage = null;
      mockConversations = [convo];

      expect(() => render(<MessagesScreen />)).not.toThrow();
    });
  });
});
