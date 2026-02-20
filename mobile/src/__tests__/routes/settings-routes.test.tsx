/**
 * Smoke tests for settings routes.
 * Verifies every settings screen renders without crashing.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mock screen components using R.createElement ---
jest.mock('../../screens/settings/SettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { SettingsScreen: () => R.createElement(RN.View, { testID: 'mock-SettingsScreen' }, R.createElement(RN.Text, null, 'SettingsScreen')) };
});

jest.mock('../../screens/settings/AccessibilitySettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { AccessibilitySettingsScreen: () => R.createElement(RN.View, { testID: 'mock-AccessibilitySettingsScreen' }, R.createElement(RN.Text, null, 'AccessibilitySettingsScreen')) };
});

jest.mock('../../screens/settings/BlockedAccountsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { BlockedAccountsScreen: () => R.createElement(RN.View, { testID: 'mock-BlockedAccountsScreen' }, R.createElement(RN.Text, null, 'BlockedAccountsScreen')) };
});

jest.mock('../../screens/settings/MutedAccountsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { MutedAccountsScreen: () => R.createElement(RN.View, { testID: 'mock-MutedAccountsScreen' }, R.createElement(RN.Text, null, 'MutedAccountsScreen')) };
});

jest.mock('../../screens/settings/PrivacySettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { PrivacySettingsScreen: () => R.createElement(RN.View, { testID: 'mock-PrivacySettingsScreen' }, R.createElement(RN.Text, null, 'PrivacySettingsScreen')) };
});

jest.mock('../../screens/settings/DataExportScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { DataExportScreen: () => R.createElement(RN.View, { testID: 'mock-DataExportScreen' }, R.createElement(RN.Text, null, 'DataExportScreen')) };
});

jest.mock('../../screens/settings/ContentModerationSettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ContentModerationSettingsScreen: () => R.createElement(RN.View, { testID: 'mock-ContentModerationSettingsScreen' }, R.createElement(RN.Text, null, 'ContentModerationSettingsScreen')) };
});

jest.mock('../../screens/settings/LabelersSettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { LabelersSettingsScreen: () => R.createElement(RN.View, { testID: 'mock-LabelersSettingsScreen' }, R.createElement(RN.Text, null, 'LabelersSettingsScreen')) };
});

jest.mock('../../screens/settings/MediaCacheScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { MediaCacheScreen: () => R.createElement(RN.View, { testID: 'mock-MediaCacheScreen' }, R.createElement(RN.Text, null, 'MediaCacheScreen')) };
});

jest.mock('../../screens/settings/ModerationHistoryScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ModerationHistoryScreen: () => R.createElement(RN.View, { testID: 'mock-ModerationHistoryScreen' }, R.createElement(RN.Text, null, 'ModerationHistoryScreen')) };
});

jest.mock('../../screens/settings/MutedWordsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { MutedWordsScreen: () => R.createElement(RN.View, { testID: 'mock-MutedWordsScreen' }, R.createElement(RN.Text, null, 'MutedWordsScreen')) };
});

jest.mock('../../screens/settings/NotificationPreferencesScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { NotificationPreferencesScreen: () => R.createElement(RN.View, { testID: 'mock-NotificationPreferencesScreen' }, R.createElement(RN.Text, null, 'NotificationPreferencesScreen')) };
});

jest.mock('../../screens/settings/PerformanceSettingsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { PerformanceSettingsScreen: () => R.createElement(RN.View, { testID: 'mock-PerformanceSettingsScreen' }, R.createElement(RN.Text, null, 'PerformanceSettingsScreen')) };
});

jest.mock('../../screens/settings/ComposerDefaultsScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { ComposerDefaultsScreen: () => R.createElement(RN.View, { testID: 'mock-ComposerDefaultsScreen' }, R.createElement(RN.Text, null, 'ComposerDefaultsScreen')) };
});

// Import routes
import SettingsRoute from '../../../app/(app)/settings';
import AccessibilityRoute from '../../../app/(app)/settings/accessibility';
import BlockedAccountsRoute from '../../../app/(app)/settings/blocked';
import MutedAccountsRoute from '../../../app/(app)/settings/muted';
import PrivacyRoute from '../../../app/(app)/settings/privacy';
import DataExportRoute from '../../../app/(app)/settings/data-export';
import ContentModerationRoute from '../../../app/(app)/settings/content-moderation';
import LabelersRoute from '../../../app/(app)/settings/labelers';
import MediaCacheRoute from '../../../app/(app)/settings/media-cache';
import ModerationHistoryRoute from '../../../app/(app)/settings/moderation-history';
import MutedWordsRoute from '../../../app/(app)/settings/muted-words';
import NotificationPreferencesRoute from '../../../app/(app)/settings/notification-preferences';
import PerformanceRoute from '../../../app/(app)/settings/performance';
import ComposerDefaultsRoute from '../../../app/(app)/settings/composer-defaults';

describe('Settings Routes - Smoke Tests', () => {
  it('renders SettingsRoute without crash', () => {
    const { getByTestId } = render(<SettingsRoute />);
    expect(getByTestId('mock-SettingsScreen')).toBeTruthy();
  });

  it('renders AccessibilityRoute without crash', () => {
    const { getByTestId } = render(<AccessibilityRoute />);
    expect(getByTestId('mock-AccessibilitySettingsScreen')).toBeTruthy();
  });

  it('renders BlockedAccountsRoute without crash', () => {
    const { getByTestId } = render(<BlockedAccountsRoute />);
    expect(getByTestId('mock-BlockedAccountsScreen')).toBeTruthy();
  });

  it('renders MutedAccountsRoute without crash', () => {
    const { getByTestId } = render(<MutedAccountsRoute />);
    expect(getByTestId('mock-MutedAccountsScreen')).toBeTruthy();
  });

  it('renders PrivacyRoute without crash', () => {
    const { getByTestId } = render(<PrivacyRoute />);
    expect(getByTestId('mock-PrivacySettingsScreen')).toBeTruthy();
  });

  it('renders DataExportRoute without crash', () => {
    const { getByTestId } = render(<DataExportRoute />);
    expect(getByTestId('mock-DataExportScreen')).toBeTruthy();
  });

  it('renders ContentModerationRoute without crash', () => {
    const { getByTestId } = render(<ContentModerationRoute />);
    expect(getByTestId('mock-ContentModerationSettingsScreen')).toBeTruthy();
  });

  it('renders LabelersRoute without crash', () => {
    const { getByTestId } = render(<LabelersRoute />);
    expect(getByTestId('mock-LabelersSettingsScreen')).toBeTruthy();
  });

  it('renders MediaCacheRoute without crash', () => {
    const { getByTestId } = render(<MediaCacheRoute />);
    expect(getByTestId('mock-MediaCacheScreen')).toBeTruthy();
  });

  it('renders ModerationHistoryRoute without crash', () => {
    const { getByTestId } = render(<ModerationHistoryRoute />);
    expect(getByTestId('mock-ModerationHistoryScreen')).toBeTruthy();
  });

  it('renders MutedWordsRoute without crash', () => {
    const { getByTestId } = render(<MutedWordsRoute />);
    expect(getByTestId('mock-MutedWordsScreen')).toBeTruthy();
  });

  it('renders NotificationPreferencesRoute without crash', () => {
    const { getByTestId } = render(<NotificationPreferencesRoute />);
    expect(getByTestId('mock-NotificationPreferencesScreen')).toBeTruthy();
  });

  it('renders PerformanceRoute without crash', () => {
    const { getByTestId } = render(<PerformanceRoute />);
    expect(getByTestId('mock-PerformanceSettingsScreen')).toBeTruthy();
  });

  it('renders ComposerDefaultsRoute without crash', () => {
    const { getByTestId } = render(<ComposerDefaultsRoute />);
    expect(getByTestId('mock-ComposerDefaultsScreen')).toBeTruthy();
  });
});
