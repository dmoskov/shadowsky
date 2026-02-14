// Setup file for Jest
// Note: @testing-library/react-native v12.4+ has built-in matchers

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
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
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  usePathname: () => '/',
  useSegments: () => [],
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

// Mock AT Protocol client
jest.mock('./src/services/atproto/client', () => ({
  getAtProtoClient: jest.fn(() => ({
    getAgent: jest.fn(() => ({
      session: null,
      login: jest.fn(),
      resumeSession: jest.fn(),
      getProfile: jest.fn(),
    })),
  })),
}));

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useInfiniteQuery: jest.fn(),
  QueryClient: jest.fn(() => ({
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
  QueryClientProvider: ({ children }) => children,
}));

// Suppress console warnings/errors in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  currentState: 'active',
}));
