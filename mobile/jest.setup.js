// Setup file for Jest
// Only mock native modules that can't be loaded in the test environment.
// Individual tests should set up their own mocks for app-level modules
// (expo-router, react-query, atproto client, etc.)

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo native modules
jest.mock('expo-constants', () => ({
  ...jest.requireActual('expo-constants'),
  expoConfig: {
    extra: {},
  },
}));

jest.mock('expo-device', () => ({
  deviceType: 1,
  isDevice: true,
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  Stack: {
    Screen: 'Screen',
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
}));

// Patch AppState for react-native (needed by AuthContext)
const { AppState } = require('react-native');
if (AppState) {
  AppState.currentState = AppState.currentState || 'active';
  AppState.addEventListener = AppState.addEventListener || jest.fn(() => ({ remove: jest.fn() }));
} else {
  jest.mock('react-native/Libraries/AppState/AppState', () => ({
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  }));
}

// Suppress console warnings/errors in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
