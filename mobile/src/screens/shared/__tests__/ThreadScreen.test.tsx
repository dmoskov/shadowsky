import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import {
  makeAuthor,
  makeRecord,
  makePostView,
  mockTheme,
} from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../../contexts/ModerationContext', () => ({
  useModeration: () => ({
    shouldHideContent: jest.fn(() => false),
    shouldWarnContent: jest.fn(() => false),
    shouldBlurImages: jest.fn(() => false),
    getContentWarningText: jest.fn(() => ''),
  }),
}));

jest.mock('../../../contexts/SharedTransitionContext', () => ({
  useSharedTransition: () => ({
    prepareTransition: jest.fn(),
    activateTransition: jest.fn(),
    cancelTransition: jest.fn(),
    state: { active: false, sourceLayout: null, postData: null },
  }),
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useBlockUser: () => ({ mutateAsync: jest.fn() }),
  useMuteUser: () => ({ mutateAsync: jest.fn() }),
  useFollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../../../hooks/usePostTranslation', () => ({
  usePostTranslation: () => ({
    showTranslateButton: false,
    isTranslating: false,
    translatedText: null,
    isShowingTranslation: false,
    translationError: null,
    sourceLanguageName: null,
    handleTranslate: jest.fn(),
  }),
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../../utils/share', () => ({
  sharePost: jest.fn(),
}));

jest.mock('../../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

jest.mock('../../../components/PostEmbed', () => ({
  PostEmbed: () => null,
}));

jest.mock('../../../components/ContentLabelWarning', () => ({
  ContentLabelWarning: ({ children }: any) => children,
}));

jest.mock('../../../components/ReportModal', () => ({
  ReportModal: () => null,
}));

jest.mock('../../../components/SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

jest.mock('../../../utils/rich-text', () => ({
  RichText: ({ text }: any) => {
    const { Text } = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('../../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// Mock ThreadSkeleton (shown during loading)
jest.mock('../../../components/ThreadSkeleton', () => ({
  ThreadSkeleton: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="thread-skeleton">
        <Text>Loading thread...</Text>
      </View>
    );
  },
}));

// Mock ErrorState
jest.mock('../../../components/ErrorState', () => ({
  ErrorState: ({ message, onRetry }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="error-state">
        <Text>{message}</Text>
        {onRetry && (
          <TouchableOpacity testID="retry-button" onPress={onRetry}>
            <Text>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

// Mock ThreadSummary
jest.mock('../../../components/ThreadSummary', () => ({
  ThreadSummary: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="thread-summary">
        <Text>Thread Summary</Text>
      </View>
    );
  },
}));

// Mock ThreadNavigator
jest.mock('../../../components/ThreadNavigator', () => ({
  ThreadNavigator: () => {
    const { View } = require('react-native');
    return <View testID="thread-navigator" />;
  },
}));

// Mock the AT Protocol client (used by buildPostUri)
const mockGetProfile = jest.fn();
jest.mock('../../../services/atproto/client', () => ({
  getAtProtoClient: () => ({
    getAgent: () => ({
      getProfile: mockGetProfile,
    }),
  }),
}));

// Mock hooks used by ThreadScreen
const mockRefetch = jest.fn().mockResolvedValue(undefined);
const mockUsePostThread = jest.fn();
jest.mock('../../../hooks/api/useFeed', () => ({
  usePostThread: (...args: any[]) => mockUsePostThread(...args),
}));

const mockCreatePostMutateAsync = jest.fn();
jest.mock('../../../hooks/api/usePosts', () => ({
  useLikePost: () => ({ mutate: jest.fn() }),
  useUnlikePost: () => ({ mutate: jest.fn() }),
  useRepost: () => ({ mutate: jest.fn() }),
  useDeleteRepost: () => ({ mutate: jest.fn() }),
  useCreatePost: () => ({
    mutateAsync: mockCreatePostMutateAsync,
    isPending: false,
  }),
}));

jest.mock('../../../hooks/api/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: jest.fn(() => false),
    toggleBookmark: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({
    navigateToProfile: jest.fn(),
    navigateToCompose: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useSpotlightIndex', () => ({
  useSpotlightPost: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────
import { ThreadScreen } from '../ThreadScreen';

// ─── Helpers ──────────────────────────────────────────────

const ROOT_URI = 'at://did:plc:testdid123/app.bsky.feed.post/root';

function makeThreadPost(uri: string, text: string, handle: string) {
  return {
    uri,
    cid: `cid-${uri}`,
    author: makeAuthor({ handle, displayName: handle.split('.')[0] }),
    record: makeRecord({ text }),
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    quoteCount: 0,
    indexedAt: '2025-01-01T12:00:00.000Z',
    labels: [],
    viewer: {},
  };
}

function makeThreadNode(
  uri: string,
  text: string,
  handle: string,
  replies: any[] = [],
  parentUri?: string,
) {
  const post = makeThreadPost(uri, text, handle);
  const record: any = { ...post.record };
  if (parentUri) {
    record.reply = {
      parent: { uri: parentUri, cid: `cid-${parentUri}` },
      root: { uri: ROOT_URI, cid: `cid-${ROOT_URI}` },
    };
    post.record = record;
  }
  return {
    post,
    replies,
  };
}

/**
 * Build a mock thread data object matching AT Protocol ThreadViewPost shape.
 */
function makeThread(replyNodes: any[] = []) {
  return makeThreadNode(ROOT_URI, 'Root post content', 'op.bsky.social', replyNodes);
}

function setupResolvedThread(threadData: any) {
  mockGetProfile.mockResolvedValue({
    data: { did: 'did:plc:testdid123' },
  });
  mockUsePostThread.mockReturnValue({
    data: threadData,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  });
}

// ─── Tests ─────────────────────────────────────────────────

describe('ThreadScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePostThread.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  describe('loading states', () => {
    it('shows skeleton while resolving URI', () => {
      // Don't resolve the profile yet — simulate URI resolution in progress
      mockGetProfile.mockReturnValue(new Promise(() => {}));
      mockUsePostThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { getByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(getByTestId('thread-skeleton')).toBeTruthy();
    });

    it('shows skeleton while thread is loading', async () => {
      mockGetProfile.mockResolvedValue({
        data: { did: 'did:plc:testdid123' },
      });
      mockUsePostThread.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      const { getByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      // Wait for URI resolution to complete
      await waitFor(() => {
        expect(getByTestId('thread-skeleton')).toBeTruthy();
      });
    });
  });

  describe('error states', () => {
    it('shows skeleton when URI resolution fails (postUri stays null)', async () => {
      // When profile resolution fails, postUri remains null so the
      // component falls through to the `!postUri` skeleton check before
      // reaching the resolveError check.
      mockGetProfile.mockRejectedValue(new Error('Profile not found'));
      mockUsePostThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { getByTestId } = render(
        <ThreadScreen handle="unknown.bsky.social" postId="xyz" />
      );

      // The skeleton is shown because postUri is null
      expect(getByTestId('thread-skeleton')).toBeTruthy();
    });

    it('shows error state when thread fetch fails', async () => {
      mockGetProfile.mockResolvedValue({
        data: { did: 'did:plc:testdid123' },
      });
      mockUsePostThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      const { findByTestId, findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      const errorState = await findByTestId('error-state');
      expect(errorState).toBeTruthy();
      expect(await findByText('Network error')).toBeTruthy();
    });

    it('shows "Thread not found" when thread data is empty', async () => {
      mockGetProfile.mockResolvedValue({
        data: { did: 'did:plc:testdid123' },
      });
      // Thread loaded but has no post data
      mockUsePostThread.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('Thread not found')).toBeTruthy();
    });
  });

  describe('rendering thread content', () => {
    it('renders root post when thread loads', async () => {
      const thread = makeThread();
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('Root post content')).toBeTruthy();
    });

    it('renders "No replies yet" when thread has no replies', async () => {
      const thread = makeThread([]);
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('No replies yet')).toBeTruthy();
    });

    it('renders direct replies to the root post', async () => {
      const reply1 = makeThreadNode(
        'at://did:plc:r1/app.bsky.feed.post/r1',
        'First reply text',
        'alice.bsky.social',
        [],
        ROOT_URI,
      );
      const reply2 = makeThreadNode(
        'at://did:plc:r2/app.bsky.feed.post/r2',
        'Second reply text',
        'bob.bsky.social',
        [],
        ROOT_URI,
      );
      const thread = makeThread([reply1, reply2]);
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('First reply text')).toBeTruthy();
      expect(await findByText('Second reply text')).toBeTruthy();
    });

    it('renders nested replies (thread depth 3)', async () => {
      const reply1Uri = 'at://did:plc:r1/app.bsky.feed.post/r1';
      const reply2Uri = 'at://did:plc:r2/app.bsky.feed.post/r2';

      const nestedReply = makeThreadNode(
        reply2Uri,
        'Nested reply',
        'carol.bsky.social',
        [],
        reply1Uri,
      );
      const topReply = makeThreadNode(
        reply1Uri,
        'Top-level reply',
        'alice.bsky.social',
        [nestedReply],
        ROOT_URI,
      );
      const thread = makeThread([topReply]);
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('Top-level reply')).toBeTruthy();
      expect(await findByText('Nested reply')).toBeTruthy();
    });

    it('renders deeply nested thread (depth 4)', async () => {
      const uris = [
        'at://did:plc:r1/app.bsky.feed.post/r1',
        'at://did:plc:r2/app.bsky.feed.post/r2',
        'at://did:plc:r3/app.bsky.feed.post/r3',
        'at://did:plc:r4/app.bsky.feed.post/r4',
      ];

      const depth4 = makeThreadNode(uris[3], 'Depth 4', 'd.bsky.social', [], uris[2]);
      const depth3 = makeThreadNode(uris[2], 'Depth 3', 'c.bsky.social', [depth4], uris[1]);
      const depth2 = makeThreadNode(uris[1], 'Depth 2', 'b.bsky.social', [depth3], uris[0]);
      const depth1 = makeThreadNode(uris[0], 'Depth 1', 'a.bsky.social', [depth2], ROOT_URI);
      const thread = makeThread([depth1]);
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText('Depth 1')).toBeTruthy();
      expect(await findByText('Depth 2')).toBeTruthy();
      expect(await findByText('Depth 3')).toBeTruthy();
      expect(await findByText('Depth 4')).toBeTruthy();
    });
  });

  describe('collapse / expand thread branches', () => {
    function makeThreadWithCollapsibleBranch() {
      const parentUri = 'at://did:plc:r1/app.bsky.feed.post/r1';
      const childUri = 'at://did:plc:r2/app.bsky.feed.post/r2';
      const child = makeThreadNode(childUri, 'Child reply', 'bob.bsky.social', [], parentUri);
      const parent = makeThreadNode(parentUri, 'Parent reply', 'alice.bsky.social', [child], ROOT_URI);
      return makeThread([parent]);
    }

    it('shows collapse button for reply nodes with children', async () => {
      const thread = makeThreadWithCollapsibleBranch();
      setupResolvedThread(thread);

      const { findAllByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      // The minus sign (\u2212) indicates an expanded, collapsible branch
      const minusSigns = await findAllByText('\u2212');
      expect(minusSigns.length).toBeGreaterThanOrEqual(1);
    });

    it('collapses a thread branch when collapse button is pressed', async () => {
      const thread = makeThreadWithCollapsibleBranch();
      setupResolvedThread(thread);

      const { findAllByText, findByText, queryByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      // Verify child is visible
      expect(await findByText('Child reply')).toBeTruthy();

      // Press collapse
      const collapseButtons = await findAllByText('\u2212');
      await act(() => {
        fireEvent.press(collapseButtons[0]);
      });

      // Child should be hidden
      expect(queryByText('Child reply')).toBeNull();
    });

    it('shows hidden reply count when branch is collapsed', async () => {
      const thread = makeThreadWithCollapsibleBranch();
      setupResolvedThread(thread);

      const { findAllByText, findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      await findByText('Child reply');

      const collapseButtons = await findAllByText('\u2212');
      await act(() => {
        fireEvent.press(collapseButtons[0]);
      });

      // Should show "1 hidden reply"
      expect(await findByText(/1 hidden reply/)).toBeTruthy();
    });

    it('expands a collapsed branch when expand button is pressed', async () => {
      const thread = makeThreadWithCollapsibleBranch();
      setupResolvedThread(thread);

      const { findAllByText, findByText, queryByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      await findByText('Child reply');

      // Collapse
      const collapseButtons = await findAllByText('\u2212');
      await act(() => {
        fireEvent.press(collapseButtons[0]);
      });
      expect(queryByText('Child reply')).toBeNull();

      // Expand (the "+" button should now be present)
      const expandButton = await findByText('+');
      await act(() => {
        fireEvent.press(expandButton);
      });

      // Child should be visible again
      expect(await findByText('Child reply')).toBeTruthy();
    });

    it('expands when collapsed indicator is pressed', async () => {
      const thread = makeThreadWithCollapsibleBranch();
      setupResolvedThread(thread);

      const { findAllByText, findByText, queryByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      await findByText('Child reply');

      // Collapse
      const collapseButtons = await findAllByText('\u2212');
      await act(() => {
        fireEvent.press(collapseButtons[0]);
      });
      expect(queryByText('Child reply')).toBeNull();

      // Press the collapsed indicator
      const indicator = await findByText(/1 hidden reply/);
      await act(() => {
        fireEvent.press(indicator);
      });

      // Child should reappear
      expect(await findByText('Child reply')).toBeTruthy();
    });
  });

  describe('thread summary', () => {
    it('shows thread summary when thread has 5 or more replies', async () => {
      const replies = Array.from({ length: 5 }, (_, i) =>
        makeThreadNode(
          `at://did:plc:r${i}/app.bsky.feed.post/r${i}`,
          `Reply ${i + 1}`,
          `user${i}.bsky.social`,
          [],
          ROOT_URI,
        )
      );
      const thread = makeThread(replies);
      setupResolvedThread(thread);

      const { findByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByTestId('thread-summary')).toBeTruthy();
    });

    it('does not show thread summary with fewer than 5 replies', async () => {
      const replies = Array.from({ length: 3 }, (_, i) =>
        makeThreadNode(
          `at://did:plc:r${i}/app.bsky.feed.post/r${i}`,
          `Reply ${i + 1}`,
          `user${i}.bsky.social`,
          [],
          ROOT_URI,
        )
      );
      const thread = makeThread(replies);
      setupResolvedThread(thread);

      const { findByText, queryByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      await findByText('Reply 1');
      expect(queryByTestId('thread-summary')).toBeNull();
    });
  });

  describe('floating reply button', () => {
    it('renders floating reply button', async () => {
      const thread = makeThread();
      setupResolvedThread(thread);

      const { findByText } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByText(/Reply/)).toBeTruthy();
    });
  });

  describe('thread navigator', () => {
    it('shows thread navigator when there are more than 3 replies', async () => {
      const replies = Array.from({ length: 4 }, (_, i) =>
        makeThreadNode(
          `at://did:plc:r${i}/app.bsky.feed.post/r${i}`,
          `Reply ${i + 1}`,
          `user${i}.bsky.social`,
          [],
          ROOT_URI,
        )
      );
      const thread = makeThread(replies);
      setupResolvedThread(thread);

      const { findByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      expect(await findByTestId('thread-navigator')).toBeTruthy();
    });

    it('does not show thread navigator with 3 or fewer replies', async () => {
      const replies = Array.from({ length: 2 }, (_, i) =>
        makeThreadNode(
          `at://did:plc:r${i}/app.bsky.feed.post/r${i}`,
          `Reply ${i + 1}`,
          `user${i}.bsky.social`,
          [],
          ROOT_URI,
        )
      );
      const thread = makeThread(replies);
      setupResolvedThread(thread);

      const { findByText, queryByTestId } = render(
        <ThreadScreen handle="op.bsky.social" postId="root" />
      );

      await findByText('Reply 1');
      expect(queryByTestId('thread-navigator')).toBeNull();
    });
  });
});
