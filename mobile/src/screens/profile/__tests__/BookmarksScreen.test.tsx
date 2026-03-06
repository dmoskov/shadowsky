import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: { enableAISummaries: true, enableThreadSummaryPreGen: false },
  }),
}));

jest.mock('../../../hooks/useThreadSummaryPreGeneration', () => ({
  useThreadSummaryPreGeneration: jest.fn(),
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

// Mock FeedList as a simple testable component
jest.mock('../../../components/FeedList', () => {
  const { View, Text } = require('react-native');
  const React = require('react');
  const FeedList = React.forwardRef((props: any, _ref: any) => {
    const { posts, isLoading, error, emptyMessage } = props;
    return (
      <View testID="feed-list">
        {isLoading && <Text testID="bookmarks-loading">Loading...</Text>}
        {error && <Text testID="bookmarks-error">Error</Text>}
        {!isLoading && !error && posts?.length === 0 && (
          <Text testID="bookmarks-empty">{emptyMessage}</Text>
        )}
        {posts?.length > 0 && <Text testID="bookmarks-content">{posts.length} posts</Text>}
      </View>
    );
  });
  FeedList.displayName = 'FeedList';
  return { FeedList };
});

jest.mock('../../../components/CollectionManager', () => ({
  CollectionManager: () => {
    const { View } = require('react-native');
    return <View testID="collection-manager" />;
  },
}));

// Controllable mocks
const mockToggleBookmark = jest.fn();
jest.mock('../../../hooks/api', () => ({
  useBookmarks: () => ({
    isBookmarked: jest.fn(() => false),
    toggleBookmark: mockToggleBookmark,
  }),
}));

let mockCollectionBookmarks: any[] = [];
let mockIsLoading = false;
let mockError: any = null;
const mockRefetch = jest.fn();

jest.mock('../../../hooks/useBookmarkCollections', () => ({
  useCollectionBookmarks: () => ({
    bookmarks: mockCollectionBookmarks,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
  }),
}));

// ─── Import after mocks ───────────────────────────────────
import { BookmarksScreen } from '../BookmarksScreen';

// ─── Factory ──────────────────────────────────────────────

function makeBookmark(id: string, text: string, authorHandle = 'alice.bsky.social') {
  return {
    post: {
      uri: `at://did:plc:${id}/app.bsky.feed.post/${id}`,
      cid: `cid-${id}`,
      author: {
        did: `did:plc:${id}`,
        handle: authorHandle,
        displayName: authorHandle.split('.')[0],
        avatar: 'https://example.com/avatar.jpg',
      },
      record: { text, createdAt: new Date().toISOString() },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      indexedAt: new Date().toISOString(),
      labels: [],
      viewer: {},
    },
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('BookmarksScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollectionBookmarks = [];
    mockIsLoading = false;
    mockError = null;
  });

  // ─── Loading state ─────────────────────────────────────

  describe('loading state', () => {
    it('shows loading indicator when bookmarks are loading', () => {
      mockIsLoading = true;

      const { getByTestId } = render(<BookmarksScreen />);

      expect(getByTestId('bookmarks-loading')).toBeTruthy();
    });
  });

  // ─── Data rendering ────────────────────────────────────

  describe('data rendering', () => {
    it('renders bookmarks when data is available', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'First post'),
        makeBookmark('2', 'Second post'),
        makeBookmark('3', 'Third post'),
      ];

      const { getByTestId } = render(<BookmarksScreen />);

      expect(getByTestId('bookmarks-content')).toBeTruthy();
      expect(getByTestId('bookmarks-content').props.children).toEqual([3, ' posts']);
    });
  });

  // ─── Error state ───────────────────────────────────────

  describe('error state', () => {
    it('shows error indicator when there is an error', () => {
      mockError = new Error('Failed to load bookmarks');

      const { getByTestId } = render(<BookmarksScreen />);

      expect(getByTestId('bookmarks-error')).toBeTruthy();
    });
  });

  // ─── Empty states ──────────────────────────────────────

  describe('empty states', () => {
    it('shows default empty message when there are no bookmarks', () => {
      mockCollectionBookmarks = [];

      const { getByTestId } = render(<BookmarksScreen />);

      expect(getByTestId('bookmarks-empty')).toBeTruthy();
      expect(getByTestId('bookmarks-empty').props.children).toBe(
        'No bookmarks yet. Bookmark posts to see them here.'
      );
    });

    it('shows search-specific empty message when search has no results', () => {
      mockCollectionBookmarks = [makeBookmark('1', 'Hello world')];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');
      fireEvent.changeText(searchInput, 'zzz_no_match');

      expect(getByTestId('bookmarks-empty')).toBeTruthy();
      expect(getByTestId('bookmarks-empty').props.children).toBe(
        'No bookmarks match your search.'
      );
    });
  });

  // ─── Search filtering ─────────────────────────────────

  describe('search filtering', () => {
    it('filters bookmarks by post text', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'React is great'),
        makeBookmark('2', 'Vue is awesome'),
        makeBookmark('3', 'React Native rocks'),
      ];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');
      fireEvent.changeText(searchInput, 'react');

      expect(getByTestId('bookmarks-content').props.children).toEqual([2, ' posts']);
    });

    it('filters bookmarks by author handle', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'Post one', 'alice.bsky.social'),
        makeBookmark('2', 'Post two', 'bob.bsky.social'),
        makeBookmark('3', 'Post three', 'alice.bsky.social'),
      ];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');
      fireEvent.changeText(searchInput, 'bob');

      expect(getByTestId('bookmarks-content').props.children).toEqual([1, ' posts']);
    });

    it('filters bookmarks by author display name', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'Post one', 'alice.bsky.social'),
        makeBookmark('2', 'Post two', 'charlie.bsky.social'),
      ];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');
      fireEvent.changeText(searchInput, 'charlie');

      expect(getByTestId('bookmarks-content').props.children).toEqual([1, ' posts']);
    });

    it('search is case-insensitive', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'React is GREAT'),
        makeBookmark('2', 'Vue is awesome'),
      ];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');
      fireEvent.changeText(searchInput, 'REACT');

      expect(getByTestId('bookmarks-content').props.children).toEqual([1, ' posts']);
    });

    it('shows all bookmarks when search query is cleared', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'First post'),
        makeBookmark('2', 'Second post'),
      ];

      const { getByTestId, getByPlaceholderText } = render(<BookmarksScreen />);

      const searchInput = getByPlaceholderText('Search bookmarks...');

      fireEvent.changeText(searchInput, 'First');
      expect(getByTestId('bookmarks-content').props.children).toEqual([1, ' posts']);

      fireEvent.changeText(searchInput, '');
      expect(getByTestId('bookmarks-content').props.children).toEqual([2, ' posts']);
    });
  });

  // ─── Collection button ────────────────────────────────

  describe('collection button', () => {
    it('renders the All Bookmarks collection button', () => {
      const { getByText } = render(<BookmarksScreen />);

      expect(getByText(/All Bookmarks/)).toBeTruthy();
    });
  });

  // ─── Render stability ─────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing with empty data', () => {
      expect(() => render(<BookmarksScreen />)).not.toThrow();
    });

    it('renders without crashing with populated data', () => {
      mockCollectionBookmarks = [
        makeBookmark('1', 'Post one'),
        makeBookmark('2', 'Post two'),
      ];

      expect(() => render(<BookmarksScreen />)).not.toThrow();
    });

    it('renders without crashing during loading', () => {
      mockIsLoading = true;

      expect(() => render(<BookmarksScreen />)).not.toThrow();
    });

    it('renders without crashing with an error', () => {
      mockError = new Error('Network failure');

      expect(() => render(<BookmarksScreen />)).not.toThrow();
    });

    it('handles multiple re-renders without crashing', () => {
      mockCollectionBookmarks = [makeBookmark('1', 'Stable post')];

      const { rerender } = render(<BookmarksScreen />);

      expect(() => {
        rerender(<BookmarksScreen />);
        rerender(<BookmarksScreen />);
      }).not.toThrow();
    });
  });
});
