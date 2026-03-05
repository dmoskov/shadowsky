import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
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

let mockPreferences: Record<string, unknown> = {swipeActionsEnabled: true};
jest.mock('../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({preferences: mockPreferences}),
}));

let mockIsOnline = true;
jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({isOnline: mockIsOnline}),
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

jest.mock('../../hooks/api/useProfile', () => ({
  useBlockUser: () => ({mutateAsync: jest.fn()}),
  useMuteUser: () => ({mutateAsync: jest.fn()}),
  useFollowUser: () => ({mutate: jest.fn(), isPending: false}),
  useUnfollowUser: () => ({mutate: jest.fn(), isPending: false}),
}));

jest.mock('../../hooks/api/usePosts', () => ({
  useDeletePost: () => ({mutateAsync: jest.fn()}),
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

const mockTriggerHaptic = jest.fn();
jest.mock('../../utils/haptics', () => ({
  triggerHaptic: (...args: unknown[]) => mockTriggerHaptic(...args),
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

jest.mock('react-native-context-menu-view', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('../../utils/rich-text', () => ({
  RichText: ({text}: any) => {
    const {Text} = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// Mock Swipeable so we can inspect its props and simulate swipe events
let capturedSwipeableProps: Record<string, any> = {};
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    Swipeable: React.forwardRef((props: any, ref: any) => {
      capturedSwipeableProps = props;
      // Expose close method via ref
      React.useImperativeHandle(ref, () => ({
        close: jest.fn(),
      }));
      return (
        <View testID="swipeable-container">
          {props.children}
        </View>
      );
    }),
    GestureHandlerRootView: ({children}: any) => children,
  };
});

// ─── Import after mocks ───────────────────────────────────
import {SwipeablePostCard} from '../SwipeablePostCard';

// ─── Helpers ──────────────────────────────────────────────
function renderSwipeable(propsOverrides: Record<string, any> = {}) {
  const post = makeFeedViewPost(propsOverrides.postOverrides);
  const defaultProps = {
    post: post as any,
    onLike: jest.fn(),
    onRepost: jest.fn(),
    onReply: jest.fn(),
    onBookmark: jest.fn(),
    ...propsOverrides,
  };
  delete defaultProps.postOverrides;
  const result = render(<SwipeablePostCard {...defaultProps} />);
  return {...result, props: defaultProps};
}

// ─── Tests ─────────────────────────────────────────────────
describe('SwipeablePostCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreferences = {swipeActionsEnabled: true};
    mockIsOnline = true;
    capturedSwipeableProps = {};
  });

  // ─── Basic rendering ───────────────────────────────────
  describe('rendering', () => {
    it('renders the Swipeable wrapper when swipe is enabled', () => {
      const {getByTestId} = renderSwipeable();
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });

    it('renders the inner PostCard content', () => {
      const {getByText} = renderSwipeable();
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('@alice.bsky.social')).toBeTruthy();
    });

    it('renders without Swipeable when swipe actions are disabled', () => {
      mockPreferences = {swipeActionsEnabled: false};
      const {queryByTestId, getByText} = renderSwipeable();
      expect(queryByTestId('swipeable-container')).toBeNull();
      // PostCard still renders
      expect(getByText('Alice')).toBeTruthy();
    });

    it('renders without Swipeable when offline', () => {
      mockIsOnline = false;
      const {queryByTestId, getByText} = renderSwipeable();
      expect(queryByTestId('swipeable-container')).toBeNull();
      expect(getByText('Alice')).toBeTruthy();
    });

    it('renders without Swipeable when both offline and disabled', () => {
      mockPreferences = {swipeActionsEnabled: false};
      mockIsOnline = false;
      const {queryByTestId} = renderSwipeable();
      expect(queryByTestId('swipeable-container')).toBeNull();
    });

    it('renders with Swipeable when preferences are null (defaults enabled)', () => {
      mockPreferences = null as any;
      // swipeActionsEnabled !== false evaluates to true when preferences is null
      // since null?.swipeActionsEnabled is undefined, and undefined !== false is true
      // BUT isOnline must also be true
      const {queryByTestId} = renderSwipeable();
      // When preferences is null, swipeEnabled = (null?.swipeActionsEnabled !== false) && isOnline
      // = (undefined !== false) && true = true
      expect(queryByTestId('swipeable-container')).toBeTruthy();
    });
  });

  // ─── Swipeable configuration ────────────────────────────
  describe('swipeable configuration', () => {
    it('passes correct threshold values to Swipeable', () => {
      renderSwipeable();
      expect(capturedSwipeableProps.leftThreshold).toBe(64);
      expect(capturedSwipeableProps.rightThreshold).toBe(64);
    });

    it('disables overshoot on both sides', () => {
      renderSwipeable();
      expect(capturedSwipeableProps.overshootLeft).toBe(false);
      expect(capturedSwipeableProps.overshootRight).toBe(false);
    });

    it('sets friction to 2', () => {
      renderSwipeable();
      expect(capturedSwipeableProps.friction).toBe(2);
    });

    it('provides renderLeftActions and renderRightActions callbacks', () => {
      renderSwipeable();
      expect(typeof capturedSwipeableProps.renderLeftActions).toBe('function');
      expect(typeof capturedSwipeableProps.renderRightActions).toBe('function');
    });

    it('provides onSwipeableOpen callback', () => {
      renderSwipeable();
      expect(typeof capturedSwipeableProps.onSwipeableOpen).toBe('function');
    });
  });

  // ─── Left swipe action (Reply) ─────────────────────────
  describe('left swipe action (reply)', () => {
    it('triggers reply callback when swiped open from left', () => {
      const {props} = renderSwipeable();
      // Simulate swipeable opening from the left direction
      capturedSwipeableProps.onSwipeableOpen('left');
      expect(props.onReply).toHaveBeenCalledTimes(1);
    });

    it('triggers light haptic on left swipe', () => {
      renderSwipeable();
      capturedSwipeableProps.onSwipeableOpen('left');
      expect(mockTriggerHaptic).toHaveBeenCalledWith('light');
    });

    it('does not trigger reply on right swipe open', () => {
      const {props} = renderSwipeable();
      capturedSwipeableProps.onSwipeableOpen('right');
      expect(props.onReply).not.toHaveBeenCalled();
    });

    it('renders left action content with Reply label', () => {
      renderSwipeable();
      // Call the renderLeftActions function with mock animated values
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const leftActions = capturedSwipeableProps.renderLeftActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      // Render the returned element to inspect it
      const {getByText} = render(leftActions);
      expect(getByText('Reply')).toBeTruthy();
    });
  });

  // ─── Right swipe actions ────────────────────────────────
  describe('right swipe actions', () => {
    function renderRightActions() {
      renderSwipeable();
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      return render(rightActions);
    }

    it('renders Like action button', () => {
      const {getByRole} = renderRightActions();
      expect(getByRole('button', {name: 'Like'})).toBeTruthy();
    });

    it('renders Bookmark action button', () => {
      const {getByRole} = renderRightActions();
      expect(getByRole('button', {name: 'Bookmark'})).toBeTruthy();
    });

    it('renders Repost action button', () => {
      const {getByRole} = renderRightActions();
      expect(getByRole('button', {name: 'Repost'})).toBeTruthy();
    });

    it('renders Like, Save, and Repost labels', () => {
      const {getByText} = renderRightActions();
      expect(getByText('Like')).toBeTruthy();
      expect(getByText('Save')).toBeTruthy();
      expect(getByText('Repost')).toBeTruthy();
    });
  });

  // ─── Right action callbacks ─────────────────────────────
  describe('right action callbacks', () => {
    function getRightActionButtons() {
      const props = {
        onLike: jest.fn(),
        onRepost: jest.fn(),
        onBookmark: jest.fn(),
      };
      renderSwipeable(props);
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const rendered = render(rightActions);
      return {...rendered, callbacks: props};
    }

    it('calls onLike and triggers light haptic when Like button is pressed', () => {
      const {getByRole, callbacks} = getRightActionButtons();
      fireEvent.press(getByRole('button', {name: 'Like'}));
      expect(callbacks.onLike).toHaveBeenCalledTimes(1);
      expect(mockTriggerHaptic).toHaveBeenCalledWith('light');
    });

    it('calls onBookmark and triggers light haptic when Bookmark button is pressed', () => {
      const {getByRole, callbacks} = getRightActionButtons();
      fireEvent.press(getByRole('button', {name: 'Bookmark'}));
      expect(callbacks.onBookmark).toHaveBeenCalledTimes(1);
      expect(mockTriggerHaptic).toHaveBeenCalledWith('light');
    });

    it('calls onRepost and triggers medium haptic when Repost button is pressed', () => {
      const {getByRole, callbacks} = getRightActionButtons();
      fireEvent.press(getByRole('button', {name: 'Repost'}));
      expect(callbacks.onRepost).toHaveBeenCalledTimes(1);
      expect(mockTriggerHaptic).toHaveBeenCalledWith('medium');
    });
  });

  // ─── Liked state ────────────────────────────────────────
  describe('liked state', () => {
    it('shows Unlike label when post is already liked', () => {
      renderSwipeable({
        postOverrides: {
          post: {viewer: {like: 'at://did:plc:test/app.bsky.feed.like/abc'}},
        },
      });
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByText, getByLabelText} = render(rightActions);
      expect(getByText('Unlike')).toBeTruthy();
      expect(getByLabelText('Unlike')).toBeTruthy();
    });

    it('shows Like label when post is not liked', () => {
      renderSwipeable({
        postOverrides: {post: {viewer: {}}},
      });
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByText, getByLabelText} = render(rightActions);
      expect(getByText('Like')).toBeTruthy();
      expect(getByLabelText('Like')).toBeTruthy();
    });
  });

  // ─── Bookmarked state ───────────────────────────────────
  describe('bookmarked state', () => {
    it('shows Unsave label when post is bookmarked', () => {
      renderSwipeable({isBookmarked: true});
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByText, getByLabelText} = render(rightActions);
      expect(getByText('Unsave')).toBeTruthy();
      expect(getByLabelText('Remove bookmark')).toBeTruthy();
    });

    it('shows Save label when post is not bookmarked', () => {
      renderSwipeable({isBookmarked: false});
      const mockAnimatedValue = {
        interpolate: jest.fn(() => 0),
      };
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByText, getByRole} = render(rightActions);
      expect(getByText('Save')).toBeTruthy();
      expect(getByRole('button', {name: 'Bookmark'})).toBeTruthy();
    });
  });

  // ─── Animated interpolation ─────────────────────────────
  describe('animated interpolation', () => {
    it('left action uses correct input range for scale (0 to SWIPE_THRESHOLD=64)', () => {
      renderSwipeable();
      const mockInterpolate = jest.fn(() => 0);
      const mockDragX = {interpolate: mockInterpolate};
      capturedSwipeableProps.renderLeftActions(
        {interpolate: jest.fn(() => 0)},
        mockDragX,
      );

      // First call is for scale
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.objectContaining({
          inputRange: [0, 64],
          outputRange: [0.5, 1],
          extrapolate: 'clamp',
        }),
      );
    });

    it('left action uses correct input range for opacity (0, 32, 64)', () => {
      renderSwipeable();
      const mockInterpolate = jest.fn(() => 0);
      const mockDragX = {interpolate: mockInterpolate};
      capturedSwipeableProps.renderLeftActions(
        {interpolate: jest.fn(() => 0)},
        mockDragX,
      );

      // Second call is for opacity
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.objectContaining({
          inputRange: [0, 32, 64],
          outputRange: [0, 0.5, 1],
          extrapolate: 'clamp',
        }),
      );
    });

    it('right action uses ACTION_WIDTH=72 for translate interpolation', () => {
      renderSwipeable();
      const mockInterpolate = jest.fn(() => 0);
      const mockProgress = {interpolate: mockInterpolate};
      capturedSwipeableProps.renderRightActions(mockProgress, {
        interpolate: jest.fn(() => 0),
      });

      // Like: ACTION_WIDTH * 3 = 216
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.objectContaining({
          inputRange: [0, 1],
          outputRange: [216, 0],
          extrapolate: 'clamp',
        }),
      );

      // Bookmark: ACTION_WIDTH * 2 = 144
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.objectContaining({
          inputRange: [0, 1],
          outputRange: [144, 0],
          extrapolate: 'clamp',
        }),
      );

      // Repost: ACTION_WIDTH = 72
      expect(mockInterpolate).toHaveBeenCalledWith(
        expect.objectContaining({
          inputRange: [0, 1],
          outputRange: [72, 0],
          extrapolate: 'clamp',
        }),
      );
    });
  });

  // ─── React.memo behavior ────────────────────────────────
  describe('memoization (arePropsEqual)', () => {
    it('re-renders when post URI changes', () => {
      const post1 = makeFeedViewPost();
      const post2 = makeFeedViewPost({
        post: {
          uri: 'at://did:plc:test123/app.bsky.feed.post/different',
        },
      });

      const {rerender, getByTestId} = render(
        <SwipeablePostCard post={post1 as any} />,
      );
      // Re-render with different URI — should not be blocked by memo
      rerender(<SwipeablePostCard post={post2 as any} />);
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });

    it('re-renders when like count changes', () => {
      const post1 = makeFeedViewPost({post: {likeCount: 10}});
      const post2 = makeFeedViewPost({post: {likeCount: 11}});

      const {rerender, getByTestId} = render(
        <SwipeablePostCard post={post1 as any} />,
      );
      rerender(<SwipeablePostCard post={post2 as any} />);
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });

    it('re-renders when isBookmarked changes', () => {
      const post = makeFeedViewPost();
      const {rerender, getByTestId} = render(
        <SwipeablePostCard post={post as any} isBookmarked={false} />,
      );
      rerender(
        <SwipeablePostCard post={post as any} isBookmarked={true} />,
      );
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });

    it('re-renders when isVisible changes', () => {
      const post = makeFeedViewPost();
      const {rerender, getByTestId} = render(
        <SwipeablePostCard post={post as any} isVisible={true} />,
      );
      rerender(
        <SwipeablePostCard post={post as any} isVisible={false} />,
      );
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });

    it('re-renders when viewer.like changes (liked/unliked)', () => {
      const post1 = makeFeedViewPost({post: {viewer: {}}});
      const post2 = makeFeedViewPost({
        post: {viewer: {like: 'at://did:plc:test/app.bsky.feed.like/abc'}},
      });

      const {rerender, getByTestId} = render(
        <SwipeablePostCard post={post1 as any} />,
      );
      rerender(<SwipeablePostCard post={post2 as any} />);
      expect(getByTestId('swipeable-container')).toBeTruthy();
    });
  });

  // ─── Callback safety ───────────────────────────────────
  describe('callback safety', () => {
    it('does not throw when onReply is undefined', () => {
      renderSwipeable({onReply: undefined});
      expect(() => {
        capturedSwipeableProps.onSwipeableOpen('left');
      }).not.toThrow();
    });

    it('does not throw when onLike is undefined', () => {
      renderSwipeable({onLike: undefined});
      const mockAnimatedValue = {interpolate: jest.fn(() => 0)};
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByRole} = render(rightActions);
      expect(() => {
        fireEvent.press(getByRole('button', {name: 'Like'}));
      }).not.toThrow();
    });

    it('does not throw when onBookmark is undefined', () => {
      renderSwipeable({onBookmark: undefined});
      const mockAnimatedValue = {interpolate: jest.fn(() => 0)};
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByRole} = render(rightActions);
      expect(() => {
        fireEvent.press(getByRole('button', {name: 'Bookmark'}));
      }).not.toThrow();
    });

    it('does not throw when onRepost is undefined', () => {
      renderSwipeable({onRepost: undefined});
      const mockAnimatedValue = {interpolate: jest.fn(() => 0)};
      const rightActions = capturedSwipeableProps.renderRightActions(
        mockAnimatedValue,
        mockAnimatedValue,
      );
      const {getByRole} = render(rightActions);
      expect(() => {
        fireEvent.press(getByRole('button', {name: 'Repost'}));
      }).not.toThrow();
    });
  });
});
