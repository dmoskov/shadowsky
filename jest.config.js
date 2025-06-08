/** @type {import('jest').Config} */
export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Use jsdom for React component testing
  testEnvironment: 'jest-environment-jsdom',
  
  // Setup files to run after Jest is initialized
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  
  // Module name mapping for handling CSS and static assets
  moduleNameMapper: {
    // Mock CSS modules
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Mock static assets
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/src/test/mocks/fileMock.js',
    
    // Path aliases (if using them in the future)
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Transform configuration for TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{ts,tsx}'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/test/**'
  ],
  
  // Coverage thresholds (start low, increase over time)
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Verbose output for better debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true
};