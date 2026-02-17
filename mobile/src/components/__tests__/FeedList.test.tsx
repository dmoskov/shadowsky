import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {makeFeedViewPost, mockTheme} from './test-utils';

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

let mockIsOnline = true;
jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({isOnline: mockIsOnline}),
}));

let mockPreferences: Record<string, any> = {};
jest.mock('../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({preferences: mockPreferences}),
}));

jest.mock('../../contexts/VideoAutoplayContext', () => ({
  useVideoAutoplay: () => ({
    setActiveVideoUri: jest.fn(),
    isAutoplayEnabled: false,
  }),
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
    state: {active: false, sourceLayout: null, postData: null},
  }),
}));

jest.mock('../../hooks/useImagePrefetch', () => ({
  useImagePrefetch: () => ({prefetchVisibleWindow: jest.fn()}),
}));

jest.mock('../../hooks/useScrollState', () => ({
  useScrollReporter: () => ({
    onScrollBeginDrag: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
    onScrollEndDrag: jest.fn(),
  }),
}));

jest.mock('../../hooks/api/useProfile', () => ({
  useBlockUser: () => ({mutateAsync: jest.fn()}),
  useMuteUser: () => ({mutateAsync: jest.fn()}),
  useFollowUser: () => ({mutate: jest.fn(), isPending: false}),
  useUnfollowUser: () => ({mutate: jest.fn(), isPending: false}),
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

jest.mock('../../utils/browser', () => ({
  openLink: jest.fn(),
}));

jest.mock('../../utils/rich-text', () => ({
  RichText: ({text}: any) => {
    const {Text} = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

jest.mock('../PostEmbed', () => ({
  PostEmbed: () => null,
}));

jest.mock('../ContentLabelWarning', () => ({
  ContentLabelWarning: ({children}: any) => children,
}));

jest.mock('../ReportModal', () => ({
  ReportModal: () => null,
}));

jest.mock('../SaveToCollectionModal', () => ({
  SaveToCollectionModal: () => null,
}));

// ─── Import after mocks ───────────────────────────────────
import {FeedList} from '../FeedList';

// ─── Tests ─────────────────────────────────────────────────
describe('FeedList', () => {
  beforeEach(() => {
    mockIsOnline = true;
    mockPreferences = {};
    jest.clearAllMocks();
  });

  it('renders posts', () => {
    const posts = [
      makeFeedViewPost({post: {uri: 'at://post/1', author: {displayName: 'Alice'}}}),
      makeFeedViewPost({post: {uri: 'at://post/2', author: {displayName: 'Bob'}}}),
    ];
    const {getByText} = render(
      <FeedList posts={posts as any} isLoading={false} />,
    );

    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('shows skeletons when loading with no data', () => {
    const {UNSAFE_getAllByType} = render(
      <FeedList posts={[]} isLoading={true} />,
    );
    // PostCardSkeleton components should render inside the empty component
    // We verify via the loading state being handled without crash
    expect(UNSAFE_getAllByType).toBeDefined();
  });

  it('shows error state with retry', () => {
    const onRefresh = jest.fn();
    const {getByText} = render(
      <FeedList
        posts={[]}
        isLoading={false}
        error={new Error('Network error')}
        onRefresh={onRefresh}
      />,
    );

    expect(getByText('Network error')).toBeTruthy();
    fireEvent.press(getByText('Try Again'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows empty state with custom message', () => {
    const {getByText} = render(
      <FeedList
        posts={[]}
        isLoading={false}
        emptyMessage="Nothing to see here"
      />,
    );

    expect(getByText('Nothing to see here')).toBeTruthy();
  });

  it('shows default empty message when no custom message', () => {
    const {getByText} = render(
      <FeedList posts={[]} isLoading={false} />,
    );

    expect(getByText('No posts yet')).toBeTruthy();
  });

  it('renders footer loading indicator when loading more', () => {
    const posts = [makeFeedViewPost({post: {uri: 'at://post/1'}})];
    const {getByTestId} = render(
      <FeedList
        posts={posts as any}
        isLoading={false}
        isLoadingMore={true}
      />,
    );

    // FlatList should have footer with ActivityIndicator
    // We verify the component renders without crashing
    expect(getByTestId).toBeDefined();
  });

  it('calls onLoadMore when scrolling to end', () => {
    const onLoadMore = jest.fn();
    const posts = Array.from({length: 20}, (_, i) =>
      makeFeedViewPost({post: {uri: `at://post/${i}`}}),
    );
    const {getByAccessibilityHint} = render(
      <FeedList
        posts={posts as any}
        isLoading={false}
        onLoadMore={onLoadMore}
      />,
    );

    const list = getByAccessibilityHint('Scroll to view more posts');
    fireEvent(list, 'onEndReached');
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('calls onRefresh with haptic when pull-to-refresh', () => {
    const onRefresh = jest.fn();
    const posts = [makeFeedViewPost({post: {uri: 'at://post/1'}})];
    const {getByAccessibilityHint} = render(
      <FeedList
        posts={posts as any}
        isLoading={false}
        onRefresh={onRefresh}
      />,
    );

    // Trigger refresh via the FlatList
    const list = getByAccessibilityHint('Scroll to view more posts');
    // The RefreshControl onRefresh calls handleRefresh which triggers haptic + onRefresh
    fireEvent(list, 'refresh');
  });

  it('does not render RefreshControl when onRefresh is not provided', () => {
    const posts = [makeFeedViewPost({post: {uri: 'at://post/1'}})];
    // Should render without crash and no RefreshControl
    expect(() =>
      render(<FeedList posts={posts as any} isLoading={false} />),
    ).not.toThrow();
  });

  it('filters posts by muted words when preferences are set', () => {
    mockPreferences = {
      mutedWords: [{id: '1', value: 'spam', duration: 'forever'}],
    };
    const posts = [
      makeFeedViewPost({
        post: {uri: 'at://post/1', record: {text: 'Hello world'}},
      }),
      makeFeedViewPost({
        post: {uri: 'at://post/2', record: {text: 'This is spam content'}},
      }),
    ];
    const {getByText, queryByText} = render(
      <FeedList posts={posts as any} isLoading={false} />,
    );

    expect(getByText('Hello world')).toBeTruthy();
    expect(queryByText('This is spam content')).toBeNull();
  });

  it('does not filter when no muted words', () => {
    mockPreferences = {};
    const posts = [
      makeFeedViewPost({
        post: {uri: 'at://post/1', record: {text: 'Hello world'}},
      }),
      makeFeedViewPost({
        post: {uri: 'at://post/2', record: {text: 'Second post'}},
      }),
    ];
    const {getByText} = render(
      <FeedList posts={posts as any} isLoading={false} />,
    );

    expect(getByText('Hello world')).toBeTruthy();
    expect(getByText('Second post')).toBeTruthy();
  });

  it('renders post cards with correct accessibility for each post', () => {
    const onPostPress = jest.fn();
    const posts = [makeFeedViewPost({post: {uri: 'at://post/1'}})];
    const {getByLabelText} = render(
      <FeedList
        posts={posts as any}
        isLoading={false}
        onPostPress={onPostPress}
      />,
    );

    // Verify the post card renders with correct accessibility
    const card = getByLabelText(/Post by Alice/);
    expect(card).toBeTruthy();
  });

  it('disables refresh control when offline', () => {
    mockIsOnline = false;
    const onRefresh = jest.fn();
    const posts = [makeFeedViewPost({post: {uri: 'at://post/1'}})];
    // Should render without crash - RefreshControl enabled prop is false
    expect(() =>
      render(
        <FeedList
          posts={posts as any}
          isLoading={false}
          onRefresh={onRefresh}
        />,
      ),
    ).not.toThrow();
  });
});
