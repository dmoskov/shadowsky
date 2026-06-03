module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg|react-native-context-menu-view|@atproto/.*|@tanstack/.*)",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
  ],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Mock @atproto/api: its real ESM dep tree (multiformats/uint8arrays) can't
    // be resolved by the RN Jest resolver. Unit tests inject their own mock
    // agents, so a stubbed module surface is sufficient. See __mocks__.
    "^@atproto/api$": "<rootDir>/__mocks__/atproto-api.js",
    // Resolve babel helpers to the mobile install. When Jest transforms the
    // sibling @bsky/core TS source, the emitted require("@babel/runtime/…")
    // can't be resolved from packages/core in CI (which installs only
    // mobile/node_modules, not the repo-root one).
    "^@babel/runtime/(.*)$": "<rootDir>/node_modules/@babel/runtime/$1",
  },
  testTimeout: 10000,
  coverageThreshold: {
    global: {
      branches: 21,
      functions: 18,
      lines: 21,
      statements: 21,
    },
  },
};
