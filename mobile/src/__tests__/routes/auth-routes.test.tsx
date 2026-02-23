/**
 * Smoke tests for auth, onboarding, and utility routes.
 * Verifies login, OAuth callback, onboarding, and 404 screens render without crashing.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

// --- Mock screen components ---
jest.mock('../../screens/auth/LandingScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return { LandingScreen: () => R.createElement(RN.View, { testID: 'mock-LandingScreen' }, R.createElement(RN.Text, null, 'LandingScreen')) };
});

jest.mock('../../screens/auth/OAuthCallbackScreen', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    OAuthCallbackScreen: (props: any) => {
      const children = [R.createElement(RN.Text, { key: 'label' }, 'OAuthCallbackScreen')];
      if (props.error) children.push(R.createElement(RN.Text, { key: 'error', testID: 'oauth-error' }, props.error));
      return R.createElement(RN.View, { testID: 'mock-OAuthCallbackScreen' }, ...children);
    },
  };
});

jest.mock('../../screens/onboarding', () => {
  const RN = require('react-native');
  const R = require('react');
  return { OnboardingScreen: () => R.createElement(RN.View, { testID: 'mock-OnboardingScreen' }, R.createElement(RN.Text, null, 'OnboardingScreen')) };
});

// Import routes
import LoginRoute from '../../../app/(auth)/index';
import OAuthCallbackRoute from '../../../app/(auth)/oauth-callback';
import OnboardingRoute from '../../../app/(onboarding)/index';
import NotFoundScreen from '../../../app/+not-found';

describe('Auth Routes - Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  describe('Login', () => {
    it('renders LoginRoute without crash', () => {
      const { getByTestId } = render(<LoginRoute />);
      expect(getByTestId('mock-LandingScreen')).toBeTruthy();
    });
  });

  describe('OAuth Callback', () => {
    it('renders OAuthCallbackRoute without crash (no params)', () => {
      const { getByTestId } = render(<OAuthCallbackRoute />);
      expect(getByTestId('mock-OAuthCallbackScreen')).toBeTruthy();
    });

    it('renders OAuthCallbackRoute without error', () => {
      mockUseLocalSearchParams.mockReturnValue({});
      const { getByTestId } = render(<OAuthCallbackRoute />);
      expect(getByTestId('mock-OAuthCallbackScreen')).toBeTruthy();
    });

    it('renders OAuthCallbackRoute with error', () => {
      mockUseLocalSearchParams.mockReturnValue({
        error: 'access_denied',
      });
      const { getByTestId } = render(<OAuthCallbackRoute />);
      expect(getByTestId('oauth-error')).toBeTruthy();
    });
  });

  describe('Onboarding', () => {
    it('renders OnboardingRoute without crash', () => {
      const { getByTestId } = render(<OnboardingRoute />);
      expect(getByTestId('mock-OnboardingScreen')).toBeTruthy();
    });
  });

  describe('Not Found', () => {
    it('renders NotFoundScreen without crash', () => {
      const { getByText } = render(<NotFoundScreen />);
      expect(getByText("This screen doesn't exist.")).toBeTruthy();
    });

    it('displays link to home screen', () => {
      const { getByText } = render(<NotFoundScreen />);
      expect(getByText('Go to home screen')).toBeTruthy();
    });
  });
});
