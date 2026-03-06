import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  makeFeedViewPost,
  makeImageEmbed,
  makeExternalEmbed,
  makeQuoteEmbed,
  makeVideoEmbed,
  makeRecordWithMediaEmbed,
  mockTheme,
} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    dismissToast: jest.fn(),
    dismissAllToasts: jest.fn(),
    showUndoToast: jest.fn(),
  }),
}));

jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../contexts/ModerationContext', () => ({
  useModeration: () => ({
    shouldHideContent: jest.fn(() => false),
    shouldWarnContent: jest.fn(() => false),
    shouldBlurImages: jest.fn(() => false),
    getContentWarningText: jest.fn(() => ''),
  }),
}));

jest.mock('../../contexts/SharedTransitionContext', () => ({
  useSharedTransition: () => ({
    prepareTransition: jest.fn(),
    state: { active: false, sourceLayout: null, postData: null },
  }),
}));

jest.mock('../../hooks/api/useProfile', () => ({
  useBlockUser: () => ({ mutateAsync: jest.fn() }),
  useMuteUser: () => ({ mutateAsync: jest.fn() }),
  useFollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../../hooks/api/usePosts', () => ({
  useDeletePost: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('../../hooks/usePostTranslation', () => ({
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

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../utils/share', () => ({
  sharePost: jest.fn(),
}));

jest.mock('../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

// Mock expo-image
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

// Mock date-fns to return predictable timestamps
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

// Mock child components to simplify PostCard tests
jest.mock('../PostEmbed', () => ({
  PostEmbed: ({ embed }: any) => {
    const { View, Text } = require('react-native');
    if (!embed) return null;
    return (
      <View testID="post-embed">
        <Text>{embed.$type || 'unknown-embed'}</Text>
      </View>
    );
  },
}));

jest.mock('../ContentLabelWarning', () => ({
  ContentLabelWarning: ({ children, warningText }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="content-label-warning">
        <Text>{warningText}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('../ReportModal', () => ({
  ReportModal: () => null,
}));

// Mock react-native-context-menu-view to capture actions in test
let capturedContextMenuProps: any = {};
jest.mock('react-native-context-menu-view', () => {
  const { View } = require('react-native');
  const ContextMenuMock = ({ children, actions, onPress, ...rest }: any) => {
    capturedContextMenuProps = { actions, onPress };
    return <View testID="context-menu" {...rest}>{children}</View>;
  };
  ContextMenuMock.displayName = 'ContextMenu';
  return {
    __esModule: true,
    default: ContextMenuMock,
  };
});

jest.mock('../SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

jest.mock('../../utils/rich-text', () => ({
  RichText: ({ text }: any) => {
    const { Text } = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────
import { PostCard } from '../PostCard';

// ─── Tests ─────────────────────────────────────────────────
describe('PostCard', () => {
  beforeEach(() => {
    capturedContextMenuProps = {};
  });

  it('renders a basic text post', () => {
    const post = makeFeedViewPost();
    const { getByText, getByTestId } = render(<PostCard post={post as any} />);

    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('@alice.bsky.social')).toBeTruthy();
    expect(getByTestId('rich-text')).toBeTruthy();
    expect(getByText('2 hours ago')).toBeTruthy();
  });

  it('renders engagement counts', () => {
    const post = makeFeedViewPost({
      post: { replyCount: 10, repostCount: 20, likeCount: 30 },
    });
    const { getByText } = render(<PostCard post={post as any} />);

    expect(getByText('10')).toBeTruthy();
    expect(getByText('20')).toBeTruthy();
    expect(getByText('30')).toBeTruthy();
  });

  it('renders with zero engagement counts', () => {
    const post = makeFeedViewPost({
      post: { replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: 0 },
    });
    const { getAllByText } = render(<PostCard post={post as any} />);

    // All four counts should show "0"
    const zeros = getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('handles missing engagement counts gracefully', () => {
    const post = makeFeedViewPost({
      post: {
        replyCount: undefined,
        repostCount: undefined,
        likeCount: undefined,
      },
    });
    // Should not throw
    const { getAllByText } = render(<PostCard post={post as any} />);
    const zeros = getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('renders with image embed', () => {
    const post = makeFeedViewPost({
      post: { embed: makeImageEmbed() },
    });
    const { getByTestId } = render(<PostCard post={post as any} />);

    expect(getByTestId('post-embed')).toBeTruthy();
  });

  it('renders with external link embed', () => {
    const post = makeFeedViewPost({
      post: { embed: makeExternalEmbed() },
    });
    const { getByTestId } = render(<PostCard post={post as any} />);

    expect(getByTestId('post-embed')).toBeTruthy();
  });

  it('renders with quote embed', () => {
    const post = makeFeedViewPost({
      post: { embed: makeQuoteEmbed() },
    });
    const { getByTestId } = render(<PostCard post={post as any} />);

    expect(getByTestId('post-embed')).toBeTruthy();
  });

  it('renders with video embed', () => {
    const post = makeFeedViewPost({
      post: { embed: makeVideoEmbed() },
    });
    const { getByTestId } = render(<PostCard post={post as any} />);

    expect(getByTestId('post-embed')).toBeTruthy();
  });

  it('renders with recordWithMedia embed', () => {
    const post = makeFeedViewPost({
      post: { embed: makeRecordWithMediaEmbed() },
    });
    const { getByTestId } = render(<PostCard post={post as any} />);

    expect(getByTestId('post-embed')).toBeTruthy();
  });

  it('renders without any embed', () => {
    const post = makeFeedViewPost({
      post: { embed: undefined },
    });
    const { queryByTestId } = render(<PostCard post={post as any} />);

    expect(queryByTestId('post-embed')).toBeNull();
  });

  // ─── Edge cases that caused real production crashes ──────
  describe('edge cases (production crash regression)', () => {
    it('renders post with empty text', () => {
      const post = makeFeedViewPost({
        post: { record: { text: '' } },
      });
      // Should not crash
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with null record', () => {
      const post = makeFeedViewPost({
        post: { record: null },
      });
      // Should not throw - record guard in PostCard returns undefined
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with missing author displayName', () => {
      const post = makeFeedViewPost({
        post: { author: { displayName: undefined } },
      });
      const { getByText } = render(<PostCard post={post as any} />);

      // Should fall back to handle
      expect(getByText('alice.bsky.social')).toBeTruthy();
    });

    it('renders post with missing author avatar', () => {
      const post = makeFeedViewPost({
        post: { author: { avatar: undefined } },
      });
      // Should render placeholder avatar, not crash
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with empty labels array', () => {
      const post = makeFeedViewPost({
        post: { labels: [] },
      });
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with undefined labels', () => {
      const post = makeFeedViewPost({
        post: { labels: undefined },
      });
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with viewer that has liked', () => {
      const post = makeFeedViewPost({
        post: { viewer: { like: 'at://did:plc:test/app.bsky.feed.like/abc' } },
      });
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with undefined viewer', () => {
      const post = makeFeedViewPost({
        post: { viewer: undefined },
      });
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });

    it('renders post with missing indexedAt', () => {
      const post = makeFeedViewPost({
        post: { indexedAt: undefined },
      });
      // date-fns is mocked, so this should still render "2 hours ago"
      expect(() => render(<PostCard post={post as any} />)).not.toThrow();
    });
  });

  // ─── Interaction tests ───────────────────────────────────
  describe('interactions', () => {
    it('calls onLike when like button is pressed', () => {
      const onLike = jest.fn();
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onLike={onLike} />
      );

      const likeButton = getByLabelText(/Like\. 12 likes/);
      fireEvent.press(likeButton);

      expect(onLike).toHaveBeenCalledTimes(1);
    });

    it('calls onReply when reply button is pressed', () => {
      const onReply = jest.fn();
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onReply={onReply} />
      );

      const replyButton = getByLabelText(/Reply\. 3 replies/);
      fireEvent.press(replyButton);

      expect(onReply).toHaveBeenCalledTimes(1);
    });

    it('calls onRepost when repost button is pressed', () => {
      const onRepost = jest.fn();
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onRepost={onRepost} />
      );

      const repostButton = getByLabelText(/Repost\. 5 reposts/);
      fireEvent.press(repostButton);

      expect(onRepost).toHaveBeenCalledTimes(1);
    });

    it('renders a pressable card', () => {
      // PostCard wraps content in a TouchableOpacity with onPress.
      // The actual onPress goes through measureInWindow (native-only),
      // so we verify the card renders with the correct accessibility hint.
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onPress={jest.fn()} />
      );

      const card = getByLabelText(/Post by Alice/);
      expect(card).toBeTruthy();
      expect(card.props.accessibilityHint).toBe('Double tap to view full post. Long press for more options');
    });

    it('calls onPressProfile when author section is pressed', () => {
      const onPressProfile = jest.fn();
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onPressProfile={onPressProfile} />
      );

      const profileButton = getByLabelText(/View profile of Alice/);
      fireEvent.press(profileButton);

      expect(onPressProfile).toHaveBeenCalledWith('alice.bsky.social');
    });

    it('calls onBookmark when bookmark button is pressed', () => {
      const onBookmark = jest.fn();
      const post = makeFeedViewPost();
      const { getByLabelText } = render(
        <PostCard post={post as any} onBookmark={onBookmark} />
      );

      const bookmarkButton = getByLabelText('Bookmark post');
      fireEvent.press(bookmarkButton);

      expect(onBookmark).toHaveBeenCalledTimes(1);
    });

    it('provides native context menu with correct actions for other users posts', () => {
      const post = makeFeedViewPost();
      render(
        <PostCard post={post as any} currentUserDid="did:plc:other" />
      );

      const actionTitles = capturedContextMenuProps.actions.map((a: any) => a.title);
      expect(actionTitles).toContain('Reply');
      expect(actionTitles).toContain('Share');
      expect(actionTitles).toContain('Report Post');
      expect(actionTitles).toContain('Repost');
      expect(actionTitles).toContain('Like');
      expect(actionTitles).toContain('Bookmark');
      // Should have mute and block for other users' posts
      expect(actionTitles.some((t: string) => t.startsWith('Mute'))).toBe(true);
      expect(actionTitles.some((t: string) => t.startsWith('Block'))).toBe(true);
      // Destructive actions should be marked
      const reportAction = capturedContextMenuProps.actions.find((a: any) => a.title === 'Report Post');
      expect(reportAction.destructive).toBe(true);
    });

    it('provides native context menu with delete for own posts', () => {
      const post = makeFeedViewPost();
      render(
        <PostCard post={post as any} currentUserDid="did:plc:test123" />
      );

      const actionTitles = capturedContextMenuProps.actions.map((a: any) => a.title);
      expect(actionTitles).toContain('Delete Post');
      expect(actionTitles).not.toContain('Report Post');
      expect(actionTitles).not.toContain('Mute @alice.bsky.social');
      // Delete should be marked destructive
      const deleteAction = capturedContextMenuProps.actions.find((a: any) => a.title === 'Delete Post');
      expect(deleteAction.destructive).toBe(true);
      expect(deleteAction.systemIcon).toBe('trash');
    });

    it('dispatches correct action from context menu', () => {
      const onReply = jest.fn();
      const post = makeFeedViewPost();
      render(
        <PostCard post={post as any} onReply={onReply} currentUserDid="did:plc:other" />
      );

      // Simulate selecting "Reply" from the native context menu
      capturedContextMenuProps.onPress({
        nativeEvent: { index: 0, indexPath: [0], name: 'Reply' },
      });

      expect(onReply).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Content moderation ──────────────────────────────────
  describe('content moderation', () => {
    it('returns null for hidden content', () => {
      // Override the mock for this test
      const useModeration = require('../../contexts/ModerationContext').useModeration;
      const originalReturn = useModeration();
      jest.spyOn(
        require('../../contexts/ModerationContext'),
        'useModeration',
      ).mockReturnValue({
        ...originalReturn,
        shouldHideContent: () => true,
      });

      const post = makeFeedViewPost({
        post: { labels: [{ val: 'porn', src: 'did:plc:mod' }] },
      });
      const { toJSON } = render(<PostCard post={post as any} />);

      expect(toJSON()).toBeNull();

      // Restore
      jest.restoreAllMocks();
    });
  });
});
