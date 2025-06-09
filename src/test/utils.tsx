/**
 * Test Utilities
 * Common utilities and helpers for testing React components
 */

import React from 'react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';

// Create a custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here if needed
  initialRoute?: string;
}

// Create a test query client with faster defaults
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries for tests
        retry: false,
        // Use shorter garbage collection time
        gcTime: 0,
        // Turn off refetch on window focus
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Mock auth context value
export const mockAuthContext = {
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  agent: {
    session: {
      did: 'did:example:123',
      handle: 'testuser.bsky.social',
      email: 'test@example.com',
    },
  } as any,
};

// Simple test wrapper without auth (we'll mock auth separately)
export function TestProviders({ 
  children,
  queryClient = createTestQueryClient(),
}: { 
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// All the providers for the app (including auth)
export function AllTheProviders({ 
  children,
  queryClient = createTestQueryClient(),
}: { 
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  return (
    <TestProviders queryClient={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </TestProviders>
  );
}

// Custom render function
export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {};

  // Set initial route if specified
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for loading states to resolve
export async function waitForLoadingToFinish(screen: any) {
  const loadingElements = [
    ...screen.queryAllByText(/loading/i),
    ...screen.queryAllByTestId('skeleton'),
    ...screen.queryAllByRole('progressbar'),
  ];
  
  if (loadingElements.length > 0) {
    await screen.findByText(/./); // Wait for any text to appear
  }
}

// Mock data factories
export const createMockPost = (overrides?: Partial<any>) => ({
  uri: 'at://did:example:123/app.bsky.feed.post/abc123',
  cid: 'cid123',
  author: {
    did: 'did:example:123',
    handle: 'testuser.bsky.social',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  },
  record: {
    $type: 'app.bsky.feed.post',
    text: 'This is a test post',
    createdAt: new Date().toISOString(),
  },
  likeCount: 5,
  repostCount: 2,
  replyCount: 1,
  indexedAt: new Date().toISOString(),
  viewer: {
    like: null,
    repost: null,
  },
  ...overrides,
});

export const createMockFeedItem = (overrides?: Partial<any>) => ({
  post: createMockPost(overrides?.post),
  reason: null,
  reply: null,
  ...overrides,
});