import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

// Import after mocks
import {LinkPreviewCard} from '../LinkPreviewCard';

// ─── Helpers ──────────────────────────────────────────────

function makeMetadata(overrides: Record<string, any> = {}) {
  return {
    url: 'https://example.com/article',
    title: 'Test Article Title',
    description: 'A detailed description of the article content.',
    imageUrl: 'https://example.com/preview.jpg',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('LinkPreviewCard', () => {
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering with complete data', () => {
    it('renders the title', () => {
      const {getByText} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );
      expect(getByText('Test Article Title')).toBeTruthy();
    });

    it('renders the description', () => {
      const {getByText} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );
      expect(getByText('A detailed description of the article content.')).toBeTruthy();
    });

    it('renders the domain extracted from the URL', () => {
      const {getByText} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );
      expect(getByText('example.com')).toBeTruthy();
    });

    it('strips www. from the domain', () => {
      const metadata = makeMetadata({url: 'https://www.example.com/page'});
      const {getByText} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(getByText('example.com')).toBeTruthy();
    });

    it('renders the thumbnail image when imageUrl is present', () => {
      const {getByTestId} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );
      expect(getByTestId('expo-image')).toBeTruthy();
    });

    it('renders the dismiss button with X character', () => {
      const {getByText} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );
      expect(getByText('\u2715')).toBeTruthy();
    });
  });

  describe('missing fields', () => {
    it('does not render title when title is empty', () => {
      const metadata = makeMetadata({title: ''});
      const {queryByText} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(queryByText('Test Article Title')).toBeNull();
    });

    it('does not render description when description is empty', () => {
      const metadata = makeMetadata({description: ''});
      const {queryByText} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(queryByText('A detailed description of the article content.')).toBeNull();
    });

    it('does not render thumbnail when imageUrl is undefined', () => {
      const metadata = makeMetadata({imageUrl: undefined});
      const {queryByTestId} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(queryByTestId('expo-image')).toBeNull();
    });

    it('renders only domain when title and description are missing', () => {
      const metadata = makeMetadata({title: '', description: ''});
      const {getByText} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(getByText('example.com')).toBeTruthy();
    });

    it('falls back to raw URL when URL is invalid', () => {
      const metadata = makeMetadata({url: 'not-a-valid-url'});
      const {getByText} = render(
        <LinkPreviewCard metadata={metadata} onDismiss={mockDismiss} />,
      );
      expect(getByText('not-a-valid-url')).toBeTruthy();
    });
  });

  describe('dismiss interaction', () => {
    it('calls onDismiss when dismiss button is tapped', () => {
      const {getByText} = render(
        <LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />,
      );

      fireEvent.press(getByText('\u2715'));
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not call onDismiss before button is tapped', () => {
      render(<LinkPreviewCard metadata={makeMetadata()} onDismiss={mockDismiss} />);
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });
});
