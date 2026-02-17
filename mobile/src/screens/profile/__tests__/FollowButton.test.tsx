import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

const mockFollowMutate = jest.fn();
const mockUnfollowMutate = jest.fn();
let mockFollowPending = false;
let mockUnfollowPending = false;

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useFollowUser: () => ({ mutate: mockFollowMutate, isPending: mockFollowPending }),
  useUnfollowUser: () => ({ mutate: mockUnfollowMutate, isPending: mockUnfollowPending }),
}));

jest.mock('../../../utils/error-reporting', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// ─── Import after mocks ───────────────────────────────────
import { FollowButton } from '../../../components/FollowButton';

// ─── Tests ────────────────────────────────────────────────

describe('FollowButton interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowPending = false;
    mockUnfollowPending = false;
  });

  // ─── Follow action ─────────────────────────────────────

  describe('follow action', () => {
    it('calls followUser.mutate with DID when pressed in unfollowed state', () => {
      const { getByText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      fireEvent.press(getByText('Follow'));
      expect(mockFollowMutate).toHaveBeenCalledWith('did:plc:target');
      expect(mockFollowMutate).toHaveBeenCalledTimes(1);
    });

    it('does not call unfollow when pressing Follow', () => {
      const { getByText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      fireEvent.press(getByText('Follow'));
      expect(mockUnfollowMutate).not.toHaveBeenCalled();
    });
  });

  // ─── Unfollow action ───────────────────────────────────

  describe('unfollow action', () => {
    it('calls unfollowUser.mutate with followUri when pressed in following state', () => {
      const followUri = 'at://did:plc:me/app.bsky.graph.follow/xyz123';
      const { getByText } = render(
        <FollowButton
          did="did:plc:target"
          followUri={followUri}
          isFollowing={true}
        />
      );

      fireEvent.press(getByText('Following'));
      expect(mockUnfollowMutate).toHaveBeenCalledWith(followUri);
      expect(mockUnfollowMutate).toHaveBeenCalledTimes(1);
    });

    it('does not call follow when pressing Following', () => {
      const { getByText } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      fireEvent.press(getByText('Following'));
      expect(mockFollowMutate).not.toHaveBeenCalled();
    });

    it('calls follow (not unfollow) when isFollowing=true but no followUri', () => {
      const { getByText } = render(
        <FollowButton did="did:plc:target" isFollowing={true} />
      );

      fireEvent.press(getByText('Following'));
      // Without followUri, the guard `isFollowing && followUri` fails
      // so it falls through to followMutation
      expect(mockFollowMutate).toHaveBeenCalledWith('did:plc:target');
    });
  });

  // ─── Pending/loading state ─────────────────────────────

  describe('pending state', () => {
    it('shows ActivityIndicator when follow is pending', () => {
      mockFollowPending = true;

      const { queryByText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      // Text should not be shown during loading
      expect(queryByText('Follow')).toBeNull();
    });

    it('shows ActivityIndicator when unfollow is pending', () => {
      mockUnfollowPending = true;

      const { queryByText } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      expect(queryByText('Following')).toBeNull();
    });

    it('button is disabled when follow is pending', () => {
      mockFollowPending = true;

      const { getByRole } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('button is disabled when unfollow is pending', () => {
      mockUnfollowPending = true;

      const { getByRole } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('button shows busy accessibility state when pending', () => {
      mockFollowPending = true;

      const { getByRole } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState.busy).toBe(true);
    });
  });

  // ─── Accessibility ─────────────────────────────────────

  describe('accessibility', () => {
    it('has "Follow user" label when not following', () => {
      const { getByLabelText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      expect(getByLabelText('Follow user')).toBeTruthy();
    });

    it('has "Unfollow user" label when following', () => {
      const { getByLabelText } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      expect(getByLabelText('Unfollow user')).toBeTruthy();
    });

    it('has correct accessibility hint for follow', () => {
      const { getByLabelText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      const button = getByLabelText('Follow user');
      expect(button.props.accessibilityHint).toBe(
        'Double tap to follow this user'
      );
    });

    it('has correct accessibility hint for unfollow', () => {
      const { getByLabelText } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      const button = getByLabelText('Unfollow user');
      expect(button.props.accessibilityHint).toBe(
        'Double tap to unfollow this user'
      );
    });

    it('has button accessibilityRole', () => {
      const { getByRole } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      expect(getByRole('button')).toBeTruthy();
    });
  });

  // ─── Size variants ─────────────────────────────────────

  describe('size variants', () => {
    it('renders small size without crashing', () => {
      expect(() =>
        render(
          <FollowButton did="did:plc:target" isFollowing={false} size="small" />
        )
      ).not.toThrow();
    });

    it('renders medium size (default) without crashing', () => {
      expect(() =>
        render(
          <FollowButton did="did:plc:target" isFollowing={false} size="medium" />
        )
      ).not.toThrow();
    });

    it('renders large size without crashing', () => {
      expect(() =>
        render(
          <FollowButton did="did:plc:target" isFollowing={false} size="large" />
        )
      ).not.toThrow();
    });

    it('defaults to medium size when no size prop is provided', () => {
      expect(() =>
        render(
          <FollowButton did="did:plc:target" isFollowing={false} />
        )
      ).not.toThrow();
    });
  });

  // ─── Display text ──────────────────────────────────────

  describe('display text', () => {
    it('shows "Follow" text when not following', () => {
      const { getByText } = render(
        <FollowButton did="did:plc:target" isFollowing={false} />
      );

      expect(getByText('Follow')).toBeTruthy();
    });

    it('shows "Following" text when following', () => {
      const { getByText } = render(
        <FollowButton
          did="did:plc:target"
          followUri="at://did:plc:me/app.bsky.graph.follow/xyz"
          isFollowing={true}
        />
      );

      expect(getByText('Following')).toBeTruthy();
    });
  });

  // ─── Custom style prop ─────────────────────────────────

  describe('custom style', () => {
    it('accepts and applies custom style prop', () => {
      expect(() =>
        render(
          <FollowButton
            did="did:plc:target"
            isFollowing={false}
            style={{ marginTop: 10 }}
          />
        )
      ).not.toThrow();
    });
  });
});
