/**
 * Smoke tests for nested routes (thread, profile, list, starter-pack).
 * Verifies routes render without crashing — both happy path and error states.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

// --- Mock screen components ---
jest.mock('../../screens/shared/ThreadScreenNative', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ThreadScreenNative: (props: any) => R.createElement(RN.View, { testID: 'mock-ThreadScreenNative' },
      R.createElement(RN.Text, null, 'ThreadScreenNative:' + props.postId)),
  };
});

jest.mock('../../screens/profile/ProfileScreenNative', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ProfileScreenNative: (props: any) => R.createElement(RN.View, { testID: 'mock-ProfileScreenNative' },
      R.createElement(RN.Text, null, 'ProfileScreenNative:' + props.handle)),
  };
});

jest.mock('../../screens/lists/ListTimelineScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ListTimelineScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-ListTimelineScreen' },
      R.createElement(RN.Text, null, 'ListTimelineScreen:' + props.listId)),
  };
});

jest.mock('../../screens/starter-packs/StarterPackDetailScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    StarterPackDetailScreen: (props: any) => R.createElement(RN.View, { testID: 'mock-StarterPackDetailScreen' },
      R.createElement(RN.Text, null, 'StarterPackDetailScreen:' + props.starterPackUri)),
  };
});

jest.mock('../../components/ErrorState', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ErrorState: ({ message }: { message: string }) => R.createElement(RN.View, { testID: 'mock-ErrorState' },
      R.createElement(RN.Text, null, message)),
  };
});

// Mock useRequiredParam — variable name starts with "mock" so it's allowed
jest.mock('../../hooks/useRequiredParam', () => ({
  useRequiredParam: (paramName: string) => {
    const { useLocalSearchParams: mockGetParams } = require('expo-router');
    const params = mockGetParams();
    const value = params[paramName] as string | undefined;
    return { value: value || null, isValid: !!value };
  },
}));

// --- Import routes ---
import HomeThreadRoute from '../../../app/(app)/(tabs)/(home)/thread/[postId]';
import HomeProfileRoute from '../../../app/(app)/(tabs)/(home)/profile/[handle]';
import HomeListRoute from '../../../app/(app)/(tabs)/(home)/list/[listId]';
import StarterPackRoute from '../../../app/(app)/(tabs)/(home)/starter-pack/[uri]';
import NotificationsThreadRoute from '../../../app/(app)/(tabs)/(notifications)/thread/[postId]';
import NotificationsProfileRoute from '../../../app/(app)/(tabs)/(notifications)/profile/[handle]';
import SearchThreadRoute from '../../../app/(app)/(tabs)/(search)/thread/[postId]';
import SearchProfileRoute from '../../../app/(app)/(tabs)/(search)/profile/[handle]';
import ProfileThreadRoute from '../../../app/(app)/(tabs)/(profile)/thread/[postId]';
import UserProfileRoute from '../../../app/(app)/(tabs)/(profile)/user/[handle]';

describe('Nested Routes - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Thread routes', () => {
    it('renders home thread with valid postId', () => {
      mockUseLocalSearchParams.mockReturnValue({ postId: 'abc123', handle: 'alice.bsky.social' });
      const { getByTestId } = render(<HomeThreadRoute />);
      expect(getByTestId('mock-ThreadScreenNative')).toBeTruthy();
    });

    it('renders error state for home thread with missing postId', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<HomeThreadRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing post ID')).toBeTruthy();
    });

    it('renders notifications thread with valid postId', () => {
      mockUseLocalSearchParams.mockReturnValue({ postId: 'abc123' });
      const { getByTestId } = render(<NotificationsThreadRoute />);
      expect(getByTestId('mock-ThreadScreenNative')).toBeTruthy();
    });

    it('renders search thread with valid postId', () => {
      mockUseLocalSearchParams.mockReturnValue({ postId: 'abc123' });
      const { getByTestId } = render(<SearchThreadRoute />);
      expect(getByTestId('mock-ThreadScreenNative')).toBeTruthy();
    });

    it('renders profile thread with valid postId', () => {
      mockUseLocalSearchParams.mockReturnValue({ postId: 'abc123' });
      const { getByTestId } = render(<ProfileThreadRoute />);
      expect(getByTestId('mock-ThreadScreenNative')).toBeTruthy();
    });
  });

  describe('Profile routes', () => {
    it('renders home profile with valid handle', () => {
      mockUseLocalSearchParams.mockReturnValue({ handle: 'alice.bsky.social' });
      const { getByTestId } = render(<HomeProfileRoute />);
      expect(getByTestId('mock-ProfileScreenNative')).toBeTruthy();
    });

    it('renders error state for home profile with missing handle', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<HomeProfileRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing profile handle')).toBeTruthy();
    });

    it('renders notifications profile with valid handle', () => {
      mockUseLocalSearchParams.mockReturnValue({ handle: 'alice.bsky.social' });
      const { getByTestId } = render(<NotificationsProfileRoute />);
      expect(getByTestId('mock-ProfileScreenNative')).toBeTruthy();
    });

    it('renders search profile with valid handle', () => {
      mockUseLocalSearchParams.mockReturnValue({ handle: 'alice.bsky.social' });
      const { getByTestId } = render(<SearchProfileRoute />);
      expect(getByTestId('mock-ProfileScreenNative')).toBeTruthy();
    });

    it('renders user profile from profile tab with valid handle', () => {
      mockUseLocalSearchParams.mockReturnValue({ handle: 'alice.bsky.social' });
      const { getByTestId } = render(<UserProfileRoute />);
      expect(getByTestId('mock-ProfileScreenNative')).toBeTruthy();
    });

    it('renders error state for user profile with missing handle', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId } = render(<UserProfileRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
    });
  });

  describe('List route', () => {
    it('renders list with valid listId', () => {
      mockUseLocalSearchParams.mockReturnValue({ listId: 'list-abc' });
      const { getByTestId } = render(<HomeListRoute />);
      expect(getByTestId('mock-ListTimelineScreen')).toBeTruthy();
    });

    it('renders error state for list with missing listId', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<HomeListRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing list ID')).toBeTruthy();
    });
  });

  describe('Starter pack route', () => {
    it('renders starter pack with valid URI', () => {
      mockUseLocalSearchParams.mockReturnValue({ uri: 'at%3A%2F%2Fdid%3Aplc%3Atest%2Fapp.bsky.graph.starterpack%2Fxyz' });
      const { getByTestId } = render(<StarterPackRoute />);
      expect(getByTestId('mock-StarterPackDetailScreen')).toBeTruthy();
    });

    it('renders error state for starter pack with missing URI', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId, getByText } = render(<StarterPackRoute />);
      expect(getByTestId('mock-ErrorState')).toBeTruthy();
      expect(getByText('Missing starter pack URI')).toBeTruthy();
    });
  });
});
