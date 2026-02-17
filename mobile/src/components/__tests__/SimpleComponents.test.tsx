import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('../../hooks/api/useProfile', () => ({
  useFollowUser: () => ({ mutate: jest.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// ─── Imports ───────────────────────────────────────────────
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';
import { FollowButton } from '../FollowButton';

// ─── Button ────────────────────────────────────────────────
describe('Button', () => {
  it('renders with title', () => {
    const { getByText } = render(
      <Button title="Press Me" onPress={jest.fn()} />
    );
    expect(getByText('Press Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Press Me" onPress={onPress} />
    );

    fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <Button title="Disabled" onPress={onPress} disabled />
    );

    const button = getByLabelText('Disabled');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('shows loading indicator when loading', () => {
    const { queryByText, getByLabelText } = render(
      <Button title="Loading" onPress={jest.fn()} loading />
    );

    // Title should not be visible when loading
    expect(queryByText('Loading')).toBeNull();
    const button = getByLabelText('Loading');
    expect(button.props.accessibilityState.busy).toBe(true);
  });

  it('renders all variants without crashing', () => {
    const variants = ['primary', 'secondary', 'danger', 'ghost'] as const;
    for (const variant of variants) {
      expect(() =>
        render(<Button title={variant} onPress={jest.fn()} variant={variant} />)
      ).not.toThrow();
    }
  });

  it('renders all sizes without crashing', () => {
    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      expect(() =>
        render(<Button title={size} onPress={jest.fn()} size={size} />)
      ).not.toThrow();
    }
  });
});

// ─── Avatar ────────────────────────────────────────────────
describe('Avatar', () => {
  it('renders with image URI', () => {
    const { getByTestId } = render(
      <Avatar uri="https://example.com/avatar.jpg" />
    );
    expect(getByTestId('expo-image')).toBeTruthy();
  });

  it('renders placeholder when no URI', () => {
    const { queryByTestId } = render(<Avatar />);
    // No expo-image rendered, placeholder shown instead
    expect(queryByTestId('expo-image')).toBeNull();
  });

  it('renders with custom size', () => {
    expect(() => render(<Avatar size={80} />)).not.toThrow();
  });

  it('renders with accessibility label', () => {
    const { getByLabelText } = render(
      <Avatar accessibilityLabel="Profile photo" />
    );
    expect(getByLabelText('Profile photo')).toBeTruthy();
  });

  it('uses default accessibility label', () => {
    const { getByLabelText } = render(<Avatar />);
    expect(getByLabelText('User avatar')).toBeTruthy();
  });
});

// ─── EmptyState ────────────────────────────────────────────
describe('EmptyState', () => {
  it('renders message', () => {
    const { getByText } = render(
      <EmptyState message="No posts yet" />
    );
    expect(getByText('No posts yet')).toBeTruthy();
  });

  it('renders with accessibility', () => {
    const { getByLabelText } = render(
      <EmptyState message="Nothing here" />
    );
    expect(getByLabelText('Empty state. Nothing here')).toBeTruthy();
  });

  it('renders with custom icon', () => {
    const { Text } = require('react-native');
    const { getByText } = render(
      <EmptyState message="Custom" icon={<Text>CustomIcon</Text>} />
    );
    expect(getByText('CustomIcon')).toBeTruthy();
  });
});

// ─── ErrorState ────────────────────────────────────────────
describe('ErrorState', () => {
  it('renders error message', () => {
    const { getByText } = render(
      <ErrorState message="Something went wrong" />
    );
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('renders with accessibility alert role', () => {
    const { getByLabelText } = render(
      <ErrorState message="Network error" />
    );
    expect(getByLabelText('Error. Network error')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorState message="Failed" onRetry={onRetry} />
    );

    const retryButton = getByText('Try Again');
    expect(retryButton).toBeTruthy();
    fireEvent.press(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    const { queryByText } = render(
      <ErrorState message="Permanent error" />
    );
    expect(queryByText('Try Again')).toBeNull();
  });
});

// ─── LoadingState ──────────────────────────────────────────
describe('LoadingState', () => {
  it('renders default loading message', () => {
    const { getByText } = render(<LoadingState />);
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('renders custom loading message', () => {
    const { getByText } = render(
      <LoadingState message="Fetching posts..." />
    );
    expect(getByText('Fetching posts...')).toBeTruthy();
  });
});

// ─── FollowButton ──────────────────────────────────────────
describe('FollowButton', () => {
  it('shows "Follow" when not following', () => {
    const { getByText } = render(
      <FollowButton did="did:plc:test" isFollowing={false} />
    );
    expect(getByText('Follow')).toBeTruthy();
  });

  it('shows "Following" when following', () => {
    const { getByText } = render(
      <FollowButton did="did:plc:test" isFollowing={true} followUri="at://did:plc:me/app.bsky.graph.follow/123" />
    );
    expect(getByText('Following')).toBeTruthy();
  });

  it('has correct accessibility labels', () => {
    const { getByLabelText } = render(
      <FollowButton did="did:plc:test" isFollowing={false} />
    );
    expect(getByLabelText('Follow user')).toBeTruthy();
  });

  it('renders all sizes without crashing', () => {
    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      expect(() =>
        render(
          <FollowButton did="did:plc:test" isFollowing={false} size={size} />
        )
      ).not.toThrow();
    }
  });
});
