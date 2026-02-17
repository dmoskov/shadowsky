// Setup file for Jest
// Only mock native modules that can't be loaded in the test environment.
// Individual tests should set up their own mocks for app-level modules
// (expo-router, react-query, atproto client, etc.)

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key, value) => store.set(key, value)),
      getString: jest.fn((key) => store.get(key)),
      getNumber: jest.fn((key) => store.get(key)),
      getBoolean: jest.fn((key) => store.get(key)),
      delete: jest.fn((key) => store.delete(key)),
      contains: jest.fn((key) => store.has(key)),
      getAllKeys: jest.fn(() => [...store.keys()]),
      clearAll: jest.fn(() => store.clear()),
    })),
  };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  setItem: jest.fn(),
  getItem: jest.fn(() => null),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  canUseBiometricAuthentication: jest.fn(() => false),
  AFTER_FIRST_UNLOCK: 0,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  WHEN_UNLOCKED: 2,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 4,
}));

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
