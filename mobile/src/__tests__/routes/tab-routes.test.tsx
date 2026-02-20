/**
 * Smoke tests for tab routes.
 * Verifies every tab screen renders without crashing.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mock screen components ---
// Use require() inside mock factories to avoid out-of-scope variable issues.

jest.mock('../../screens/home/HomeScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { HomeScreen: () => R.createElement(RN.View, { testID: 'mock-HomeScreen' }, R.createElement(RN.Text, null, 'HomeScreen')) };
});

jest.mock('../../screens/home/TimelineScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { TimelineScreen: () => R.createElement(RN.View, { testID: 'mock-TimelineScreen' }, R.createElement(RN.Text, null, 'TimelineScreen')) };
});

jest.mock('../../screens/notifications/NotificationsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { NotificationsScreen: () => R.createElement(RN.View, { testID: 'mock-NotificationsScreen' }, R.createElement(RN.Text, null, 'NotificationsScreen')) };
});

jest.mock('../../../modules/native-notifications-list/src/NativeNotificationsListView', () => {
  const RN = require('react-native');
  const R = require('react');
  return { NativeNotificationsList: (props: any) => R.createElement(RN.View, { testID: 'mock-NativeNotificationsList', ...props }, R.createElement(RN.Text, null, 'NativeNotificationsList')) };
});

jest.mock('../../screens/notifications/NotificationsAnalyticsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { NotificationsAnalyticsScreen: () => R.createElement(RN.View, { testID: 'mock-NotificationsAnalyticsScreen' }, R.createElement(RN.Text, null, 'NotificationsAnalyticsScreen')) };
});

jest.mock('../../screens/profile/MyProfileScreenNative', () => {
  const RN = require('react-native');
  const R = require('react');
  return { MyProfileScreenNative: () => R.createElement(RN.View, { testID: 'mock-MyProfileScreenNative' }, R.createElement(RN.Text, null, 'MyProfileScreenNative')) };
});

jest.mock('../../screens/profile/EditProfileScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { EditProfileScreen: () => R.createElement(RN.View, { testID: 'mock-EditProfileScreen' }, R.createElement(RN.Text, null, 'EditProfileScreen')) };
});

jest.mock('../../screens/profile/BookmarksScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { BookmarksScreen: () => R.createElement(RN.View, { testID: 'mock-BookmarksScreen' }, R.createElement(RN.Text, null, 'BookmarksScreen')) };
});

jest.mock('../../screens/search/SearchScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { SearchScreen: () => R.createElement(RN.View, { testID: 'mock-SearchScreen' }, R.createElement(RN.Text, null, 'SearchScreen')) };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

// Import routes after mocks are set up
import HomeRoute from '../../../app/(app)/(tabs)/(home)/index';
import TimelineRoute from '../../../app/(app)/(tabs)/(home)/timeline';
import NotificationsRoute from '../../../app/(app)/(tabs)/(notifications)/index';
import NotificationsAnalyticsRoute from '../../../app/(app)/(tabs)/(notifications)/analytics';
import MyProfileRoute from '../../../app/(app)/(tabs)/(profile)/index';
import EditProfileRoute from '../../../app/(app)/(tabs)/(profile)/edit';
import BookmarksRoute from '../../../app/(app)/(tabs)/(profile)/bookmarks';
import SearchRoute from '../../../app/(app)/(tabs)/(search)/index';

describe('Tab Routes - Smoke Tests', () => {
  describe('Home Tab', () => {
    it('renders HomeRoute without crash', () => {
      const { getByTestId } = render(<HomeRoute />);
      expect(getByTestId('mock-HomeScreen')).toBeTruthy();
    });

    it('renders TimelineRoute without crash', () => {
      const { getByTestId } = render(<TimelineRoute />);
      expect(getByTestId('mock-TimelineScreen')).toBeTruthy();
    });
  });

  describe('Notifications Tab', () => {
    it('renders NotificationsRoute without crash', () => {
      const { toJSON } = render(<NotificationsRoute />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders NotificationsAnalyticsRoute without crash', () => {
      const { getByTestId } = render(<NotificationsAnalyticsRoute />);
      expect(getByTestId('mock-NotificationsAnalyticsScreen')).toBeTruthy();
    });
  });

  describe('Profile Tab', () => {
    it('renders MyProfileRoute without crash', () => {
      const { getByTestId } = render(<MyProfileRoute />);
      expect(getByTestId('mock-MyProfileScreenNative')).toBeTruthy();
    });

    it('renders EditProfileRoute without crash', () => {
      const { getByTestId } = render(<EditProfileRoute />);
      expect(getByTestId('mock-EditProfileScreen')).toBeTruthy();
    });

    it('renders BookmarksRoute without crash', () => {
      const { getByTestId } = render(<BookmarksRoute />);
      expect(getByTestId('mock-BookmarksScreen')).toBeTruthy();
    });
  });

  describe('Search Tab', () => {
    it('renders SearchRoute without crash', () => {
      const { getByTestId } = render(<SearchRoute />);
      expect(getByTestId('mock-SearchScreen')).toBeTruthy();
    });
  });
});
