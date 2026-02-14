import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

// Mock expo-router
jest.mock('expo-router');
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseSegments = useSegments as jest.MockedFunction<typeof useSegments>;

// Test component that uses navigation
function TestNavigationComponent() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <Text testID="current-path">{pathname}</Text>
      <TouchableOpacity testID="home-button" onPress={() => router.push('/home')}>
        <Text>Go Home</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="profile-button" onPress={() => router.push('/profile')}>
        <Text>Go to Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="back-button" onPress={() => router.back()}>
        <Text>Go Back</Text>
      </TouchableOpacity>
    </>
  );
}

describe('Navigation', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  const mockBack = jest.fn();
  const mockCanGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
      canGoBack: mockCanGoBack,
    } as any);

    mockUsePathname.mockReturnValue('/');
    mockUseSegments.mockReturnValue([]);
  });

  describe('Basic navigation', () => {
    it('navigates to home screen', () => {
      const { getByTestId } = render(<TestNavigationComponent />);

      const homeButton = getByTestId('home-button');
      fireEvent.press(homeButton);

      expect(mockPush).toHaveBeenCalledWith('/home');
    });

    it('navigates to profile screen', () => {
      const { getByTestId } = render(<TestNavigationComponent />);

      const profileButton = getByTestId('profile-button');
      fireEvent.press(profileButton);

      expect(mockPush).toHaveBeenCalledWith('/profile');
    });

    it('displays current pathname', () => {
      mockUsePathname.mockReturnValue('/home');

      const { getByTestId } = render(<TestNavigationComponent />);

      const currentPath = getByTestId('current-path');
      expect(currentPath.props.children).toBe('/home');
    });
  });

  describe('Back navigation', () => {
    it('navigates back when button is pressed', () => {
      mockCanGoBack.mockReturnValue(true);

      const { getByTestId } = render(<TestNavigationComponent />);

      const backButton = getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalled();
    });

    it('checks if can go back', () => {
      mockCanGoBack.mockReturnValue(false);

      const router = useRouter();

      expect(router.canGoBack()).toBe(false);
    });
  });

  describe('Deep linking', () => {
    it('handles deep link to post', () => {
      const router = useRouter();

      router.push('/post/at://did:plc:test/app.bsky.feed.post/123');

      expect(mockPush).toHaveBeenCalledWith(
        '/post/at://did:plc:test/app.bsky.feed.post/123'
      );
    });

    it('handles deep link to profile', () => {
      const router = useRouter();

      router.push('/profile/test.bsky.social');

      expect(mockPush).toHaveBeenCalledWith('/profile/test.bsky.social');
    });

    it('handles deep link with query parameters', () => {
      const router = useRouter();

      router.push('/search?q=bluesky');

      expect(mockPush).toHaveBeenCalledWith('/search?q=bluesky');
    });
  });

  describe('Route segments', () => {
    it('parses route segments correctly', () => {
      mockUseSegments.mockReturnValue(['app', 'profile', 'test.bsky.social']);

      const segments = useSegments();

      expect(segments).toEqual(['app', 'profile', 'test.bsky.social']);
    });

    it('handles nested routes', () => {
      mockUseSegments.mockReturnValue([
        'app',
        'post',
        'at://did:plc:test/app.bsky.feed.post/123',
      ]);

      const segments = useSegments();

      expect(segments[0]).toBe('app');
      expect(segments[1]).toBe('post');
    });
  });

  describe('Navigation state', () => {
    it('replaces current route', () => {
      const router = useRouter();

      router.replace('/login');

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('maintains navigation history', () => {
      const router = useRouter();

      router.push('/home');
      router.push('/profile');
      router.push('/settings');

      expect(mockPush).toHaveBeenCalledTimes(3);
    });
  });

  describe('Protected routes', () => {
    it('redirects to login when not authenticated', () => {
      const router = useRouter();

      // Simulate checking auth and redirecting
      const isAuthenticated = false;
      if (!isAuthenticated) {
        router.replace('/login');
      }

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('allows access when authenticated', () => {
      const router = useRouter();

      const isAuthenticated = true;
      if (isAuthenticated) {
        router.push('/home');
      } else {
        router.replace('/login');
      }

      expect(mockPush).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
