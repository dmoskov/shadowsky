import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('../../../components/icons', () => ({
  CloseIcon: () => {
    const { View } = require('react-native');
    return <View testID="close-icon" />;
  },
}));

jest.mock('../../../components/PostCardSkeleton', () => ({
  PostCardSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="post-card-skeleton" />;
  },
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

let mockDraftsData: any = undefined;
let mockIsLoading = true;
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
const mockDeleteMutate = jest.fn();

jest.mock('../../../hooks/api', () => ({
  useDrafts: () => ({
    data: mockDraftsData,
    isLoading: mockIsLoading,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
  }),
  useDeleteDraft: () => ({
    mutate: mockDeleteMutate,
  }),
}));

jest.spyOn(Alert, 'alert');

// ─── Import after mocks ───────────────────────────────────

import { DraftsScreen } from '../DraftsScreen';
import { triggerHaptic } from '../../../utils/haptics';

// ─── Factory ──────────────────────────────────────────────

function makeDraft(
  id: string,
  text: string,
  opts: {
    imageCount?: number;
    videoCount?: number;
    postCount?: number;
    deviceName?: string;
  } = {},
) {
  return {
    id,
    hasLocalMedia: true,
    missingMediaCount: 0,
    draft: {
      posts: Array.from({ length: opts.postCount || 1 }, (_, i) => ({
        text: i === 0 ? text : `Thread post ${i + 1}`,
        embedImages: Array.from(
          { length: (i === 0 ? opts.imageCount : 0) || 0 },
          () => ({ uri: 'file://img.jpg' }),
        ),
        embedVideos: Array.from(
          { length: (i === 0 ? opts.videoCount : 0) || 0 },
          () => ({ uri: 'file://vid.mp4' }),
        ),
      })),
      deviceName: opts.deviceName,
    },
  };
}

function makeDraftsPage(drafts: any[]) {
  return { pages: [{ drafts, cursor: 'cursor-1' }], pageParams: [undefined] };
}

// ─── Tests ─────────────────────────────────────────────────

describe('DraftsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDraftsData = undefined;
    mockIsLoading = true;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
  });

  // ─── Loading state ──────────────────────────────────────

  describe('loading state', () => {
    it('shows 4 PostCardSkeleton elements while loading', () => {
      mockIsLoading = true;

      const { getAllByTestId } = render(<DraftsScreen />);

      const skeletons = getAllByTestId('post-card-skeleton');
      expect(skeletons).toHaveLength(4);
    });

    it('does not show skeletons after loading completes', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([]);

      const { queryAllByTestId } = render(<DraftsScreen />);

      expect(queryAllByTestId('post-card-skeleton')).toHaveLength(0);
    });
  });

  // ─── Header ─────────────────────────────────────────────

  describe('header', () => {
    it('shows "Drafts" title in the header', () => {
      const { getByText } = render(<DraftsScreen />);

      expect(getByText('Drafts')).toBeTruthy();
    });

    it('renders a close button in the header', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([]);

      const { getAllByTestId } = render(<DraftsScreen />);

      // At least one close-icon should be present (header close button)
      expect(getAllByTestId('close-icon').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Close button ───────────────────────────────────────

  describe('close button', () => {
    it('calls router.back() when the close button is pressed', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([]);

      const { getAllByTestId } = render(<DraftsScreen />);

      // The first close-icon is the header close button
      const closeIcons = getAllByTestId('close-icon');
      // Find the parent TouchableOpacity of the first close icon (the header one)
      let closeButton = closeIcons[0].parent;
      while (closeButton && closeButton.props.onPress === undefined) {
        closeButton = closeButton.parent;
      }
      if (closeButton) {
        fireEvent.press(closeButton);
      }

      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  // ─── Drafts rendering ──────────────────────────────────

  describe('drafts rendering', () => {
    it('renders draft preview text', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'My first draft'),
        makeDraft('d2', 'Another draft post'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('My first draft')).toBeTruthy();
      expect(getByText('Another draft post')).toBeTruthy();
    });

    it('shows "(No text)" for drafts with empty text', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([makeDraft('d1', '')]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('(No text)')).toBeTruthy();
    });
  });

  // ─── Draft metadata ────────────────────────────────────

  describe('draft metadata', () => {
    it('shows image count when draft has images', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Draft with images', { imageCount: 3 }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('3 images')).toBeTruthy();
    });

    it('shows singular "image" for a single image', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Single image draft', { imageCount: 1 }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('1 image')).toBeTruthy();
    });

    it('shows video count when draft has videos', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Draft with video', { videoCount: 2 }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('2 videos')).toBeTruthy();
    });

    it('shows singular "video" for a single video', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Single video draft', { videoCount: 1 }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('1 video')).toBeTruthy();
    });

    it('shows post count for thread drafts (more than 1 post)', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Thread draft', { postCount: 3 }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('3 posts')).toBeTruthy();
    });

    it('does not show post count for single-post drafts', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Single post draft', { postCount: 1 }),
      ]);

      const { queryByText } = render(<DraftsScreen />);

      expect(queryByText('1 posts')).toBeNull();
    });

    it('shows device name when present', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Draft from iPhone', { deviceName: 'iPhone 15 Pro' }),
      ]);

      const { getByText } = render(<DraftsScreen />);

      expect(getByText('From: iPhone 15 Pro')).toBeTruthy();
    });
  });

  // ─── Draft press (navigation) ──────────────────────────

  describe('draft press navigation', () => {
    it('navigates to compose with draftId when a draft is pressed', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('draft-abc', 'Tap me'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      fireEvent.press(getByText('Tap me'));

      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(app)/compose',
        params: { draftId: 'draft-abc' },
      });
    });

    it('navigates with the correct draftId for different drafts', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('draft-1', 'First'),
        makeDraft('draft-2', 'Second'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      fireEvent.press(getByText('Second'));

      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(app)/compose',
        params: { draftId: 'draft-2' },
      });
    });
  });

  // ─── Long-press delete ─────────────────────────────────

  describe('long-press delete', () => {
    it('triggers haptic feedback on long press', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Long press me'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      fireEvent(getByText('Long press me'), 'longPress');

      expect(triggerHaptic).toHaveBeenCalledWith('medium');
    });

    it('shows delete confirmation alert on long press', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Delete me'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      fireEvent(getByText('Delete me'), 'longPress');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Draft',
        'Are you sure you want to delete this draft?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ]),
        expect.objectContaining({ cancelable: true }),
      );
    });

    it('calls deleteDraft.mutate when delete is confirmed', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Confirm delete'),
      ]);

      const { getByText } = render(<DraftsScreen />);

      fireEvent(getByText('Confirm delete'), 'longPress');

      // Extract the onPress callback from the "Delete" button in the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const deleteButton = buttons.find(
        (b: any) => b.text === 'Delete',
      );
      deleteButton.onPress();

      expect(mockDeleteMutate).toHaveBeenCalledWith('d1');
    });
  });

  // ─── Empty state ───────────────────────────────────────

  describe('empty state', () => {
    it('renders without crashing when there are no drafts and not loading', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([]);

      expect(() => render(<DraftsScreen />)).not.toThrow();
    });

    it('does not show skeletons when empty and not loading', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([]);

      const { queryAllByTestId } = render(<DraftsScreen />);

      expect(queryAllByTestId('post-card-skeleton')).toHaveLength(0);
    });
  });

  // ─── Render stability ─────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing in loading state', () => {
      mockIsLoading = true;
      mockDraftsData = undefined;

      expect(() => render(<DraftsScreen />)).not.toThrow();
    });

    it('renders without crashing with populated drafts', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([
        makeDraft('d1', 'Draft one', { imageCount: 2, postCount: 3 }),
        makeDraft('d2', 'Draft two', { videoCount: 1, deviceName: 'iPad' }),
      ]);

      expect(() => render(<DraftsScreen />)).not.toThrow();
    });

    it('handles multiple re-renders without crashing', () => {
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([makeDraft('d1', 'Stable draft')]);

      const { rerender } = render(<DraftsScreen />);

      expect(() => {
        rerender(<DraftsScreen />);
        rerender(<DraftsScreen />);
      }).not.toThrow();
    });

    it('transitions from loading to loaded without crashing', () => {
      mockIsLoading = true;
      mockDraftsData = undefined;

      const { rerender, queryAllByTestId, getByText } = render(<DraftsScreen />);

      expect(queryAllByTestId('post-card-skeleton').length).toBe(4);

      // Transition to loaded state
      mockIsLoading = false;
      mockDraftsData = makeDraftsPage([makeDraft('d1', 'Now loaded')]);

      rerender(<DraftsScreen />);

      expect(queryAllByTestId('post-card-skeleton')).toHaveLength(0);
      expect(getByText('Now loaded')).toBeTruthy();
    });
  });
});
