import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../components/UserListSkeleton', () => ({
  UserListSkeleton: () => {
    const {View} = require('react-native');
    return <View testID="user-list-skeleton" />;
  },
}));

const mockNavigateToList = jest.fn();
const mockRouterPush = jest.fn();
jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({
    navigateToList: mockNavigateToList,
    router: {push: mockRouterPush},
  }),
}));

let mockListsData: any = undefined;
let mockIsLoading = true;
let mockError: any = null;
const mockRefetch = jest.fn();
let mockIsRefetching = false;
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;

jest.mock('../../../hooks/api', () => ({
  useLists: () => ({
    data: mockListsData,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
    isRefetching: mockIsRefetching,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
  }),
}));

// ─── Import after mocks ───────────────────────────────────
import {ListsScreen} from '../ListsScreen';

// ─── Helpers ──────────────────────────────────────────────

function makeList(name: string, uri: string, memberCount = 5) {
  return {
    uri,
    name,
    description: `Description of ${name}`,
    listItemCount: memberCount,
    purpose: 'app.bsky.graph.defs#curatelist',
    creator: {did: 'did:plc:creator', handle: 'creator.bsky.social'},
  };
}

function makeListsPage(lists: any[]) {
  return {pages: [{lists, cursor: 'cursor-1'}], pageParams: [undefined]};
}

// ─── Tests ────────────────────────────────────────────────

describe('ListsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListsData = undefined;
    mockIsLoading = true;
    mockError = null;
    mockIsRefetching = false;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
  });

  // ─── Loading state ─────────────────────────────────────
  describe('loading state', () => {
    it('shows UserListSkeleton while loading', () => {
      mockIsLoading = true;
      mockListsData = undefined;

      const {getByTestId} = render(<ListsScreen />);
      expect(getByTestId('user-list-skeleton')).toBeTruthy();
    });

    it('does not show skeleton when data is loaded', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('My List', 'at://did:plc:creator/app.bsky.graph.list/1'),
      ]);

      const {queryByTestId} = render(<ListsScreen />);
      expect(queryByTestId('user-list-skeleton')).toBeNull();
    });
  });

  // ─── Lists rendering ──────────────────────────────────
  describe('lists rendering', () => {
    it('renders list names', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('Devs', 'at://did:plc:creator/app.bsky.graph.list/1'),
        makeList('Artists', 'at://did:plc:creator/app.bsky.graph.list/2'),
      ]);

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Devs')).toBeTruthy();
      expect(getByText('Artists')).toBeTruthy();
    });

    it('renders list descriptions', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('Devs', 'at://did:plc:creator/app.bsky.graph.list/1'),
      ]);

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Description of Devs')).toBeTruthy();
    });

    it('renders member counts', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('Devs', 'at://did:plc:creator/app.bsky.graph.list/1', 12),
        makeList('Artists', 'at://did:plc:creator/app.bsky.graph.list/2', 0),
      ]);

      const {getByText} = render(<ListsScreen />);
      expect(getByText('12 members')).toBeTruthy();
      expect(getByText('0 members')).toBeTruthy();
    });

    it('renders chevron for each list item', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('Devs', 'at://did:plc:creator/app.bsky.graph.list/1'),
      ]);

      const {getAllByText} = render(<ListsScreen />);
      const chevrons = getAllByText('\u203a');
      expect(chevrons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Error state ───────────────────────────────────────
  describe('error state', () => {
    it('shows "Failed to load lists" when there is an error', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');
      mockListsData = undefined;

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Failed to load lists')).toBeTruthy();
    });

    it('shows error message text', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');
      mockListsData = undefined;

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Network error')).toBeTruthy();
    });

    it('shows "Unknown error" for non-Error objects', () => {
      mockIsLoading = false;
      mockError = 'something went wrong';
      mockListsData = undefined;

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Unknown error')).toBeTruthy();
    });

    it('shows Retry button that calls refetch', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');
      mockListsData = undefined;

      const {getByText} = render(<ListsScreen />);
      const retryButton = getByText('Retry');
      expect(retryButton).toBeTruthy();

      fireEvent.press(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Empty state ───────────────────────────────────────
  describe('empty state', () => {
    it('shows "No lists yet" when data is empty', () => {
      mockIsLoading = false;
      mockError = null;
      mockListsData = makeListsPage([]);

      const {getByText} = render(<ListsScreen />);
      expect(getByText('No lists yet')).toBeTruthy();
    });

    it('shows instructional subtext in empty state', () => {
      mockIsLoading = false;
      mockError = null;
      mockListsData = makeListsPage([]);

      const {getByText} = render(<ListsScreen />);
      expect(
        getByText('Create lists on the web or other clients to see them here'),
      ).toBeTruthy();
    });
  });

  // ─── Create list button ────────────────────────────────
  describe('create list button', () => {
    it('renders "+ Create List" button', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([]);

      const {getByText} = render(<ListsScreen />);
      expect(getByText('+ Create List')).toBeTruthy();
    });

    it('navigates to create screen on press', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([]);

      const {getByText} = render(<ListsScreen />);
      fireEvent.press(getByText('+ Create List'));
      expect(mockRouterPush).toHaveBeenCalledWith('/(app)/lists/create');
    });
  });

  // ─── List press navigation ─────────────────────────────
  describe('list press navigation', () => {
    it('calls navigateToList with encoded URI on list press', () => {
      mockIsLoading = false;
      const listUri = 'at://did:plc:creator/app.bsky.graph.list/abc123';
      mockListsData = makeListsPage([makeList('Devs', listUri)]);

      const {getByText} = render(<ListsScreen />);
      fireEvent.press(getByText('Devs'));
      expect(mockNavigateToList).toHaveBeenCalledWith(
        encodeURIComponent(listUri),
      );
    });

    it('navigates to the correct list when multiple lists exist', () => {
      mockIsLoading = false;
      const uri1 = 'at://did:plc:creator/app.bsky.graph.list/1';
      const uri2 = 'at://did:plc:creator/app.bsky.graph.list/2';
      mockListsData = makeListsPage([
        makeList('Devs', uri1),
        makeList('Artists', uri2),
      ]);

      const {getByText} = render(<ListsScreen />);

      fireEvent.press(getByText('Artists'));
      expect(mockNavigateToList).toHaveBeenCalledWith(
        encodeURIComponent(uri2),
      );

      fireEvent.press(getByText('Devs'));
      expect(mockNavigateToList).toHaveBeenCalledWith(
        encodeURIComponent(uri1),
      );
    });
  });

  // ─── Render stability ─────────────────────────────────
  describe('render stability', () => {
    it('renders without crashing in loading state', () => {
      mockIsLoading = true;
      mockListsData = undefined;
      expect(() => render(<ListsScreen />)).not.toThrow();
    });

    it('renders without crashing with empty data', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([]);
      expect(() => render(<ListsScreen />)).not.toThrow();
    });

    it('renders without crashing with error', () => {
      mockIsLoading = false;
      mockError = new Error('fail');
      mockListsData = undefined;
      expect(() => render(<ListsScreen />)).not.toThrow();
    });

    it('renders without crashing with populated data', () => {
      mockIsLoading = false;
      mockListsData = makeListsPage([
        makeList('A', 'at://did:plc:creator/app.bsky.graph.list/a'),
        makeList('B', 'at://did:plc:creator/app.bsky.graph.list/b'),
        makeList('C', 'at://did:plc:creator/app.bsky.graph.list/c'),
      ]);
      expect(() => render(<ListsScreen />)).not.toThrow();
    });

    it('handles undefined data gracefully', () => {
      mockIsLoading = false;
      mockListsData = undefined;
      mockError = null;
      expect(() => render(<ListsScreen />)).not.toThrow();
    });

    it('handles multiple pages of data', () => {
      mockIsLoading = false;
      mockListsData = {
        pages: [
          {
            lists: [
              makeList('Page1List', 'at://did:plc:creator/app.bsky.graph.list/p1'),
            ],
            cursor: 'cursor-1',
          },
          {
            lists: [
              makeList('Page2List', 'at://did:plc:creator/app.bsky.graph.list/p2'),
            ],
            cursor: 'cursor-2',
          },
        ],
        pageParams: [undefined, 'cursor-1'],
      };

      const {getByText} = render(<ListsScreen />);
      expect(getByText('Page1List')).toBeTruthy();
      expect(getByText('Page2List')).toBeTruthy();
    });

    it('renders list without description', () => {
      mockIsLoading = false;
      const listWithoutDescription = {
        uri: 'at://did:plc:creator/app.bsky.graph.list/nodesc',
        name: 'No Description List',
        listItemCount: 3,
        purpose: 'app.bsky.graph.defs#curatelist',
        creator: {did: 'did:plc:creator', handle: 'creator.bsky.social'},
      };
      mockListsData = makeListsPage([listWithoutDescription]);

      const {getByText, queryByText} = render(<ListsScreen />);
      expect(getByText('No Description List')).toBeTruthy();
      expect(getByText('3 members')).toBeTruthy();
      expect(queryByText('Description of No Description List')).toBeNull();
    });
  });
});
