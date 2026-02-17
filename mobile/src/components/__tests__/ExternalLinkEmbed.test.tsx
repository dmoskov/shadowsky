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

const mockOpenLink = jest.fn(() => Promise.resolve());
jest.mock('../../utils/browser', () => ({
  openLink: (...args: any[]) => mockOpenLink(...args),
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import after mocks
import {ExternalLinkEmbed} from '../ExternalLinkEmbed';

// ─── Helpers ──────────────────────────────────────────────

function makeExternal(overrides: Record<string, any> = {}) {
  return {
    uri: 'https://example.com/article',
    title: 'Test Article Title',
    description: 'A test article description for testing purposes.',
    thumb: 'https://example.com/thumb.jpg',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('ExternalLinkEmbed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering with complete data', () => {
    it('renders the title', () => {
      const {getByText} = render(<ExternalLinkEmbed external={makeExternal()} />);
      expect(getByText('Test Article Title')).toBeTruthy();
    });

    it('renders the description', () => {
      const {getByText} = render(<ExternalLinkEmbed external={makeExternal()} />);
      expect(getByText('A test article description for testing purposes.')).toBeTruthy();
    });

    it('renders the domain extracted from the URL', () => {
      const {getByText} = render(<ExternalLinkEmbed external={makeExternal()} />);
      expect(getByText('example.com')).toBeTruthy();
    });

    it('strips www. from the domain', () => {
      const external = makeExternal({uri: 'https://www.example.com/page'});
      const {getByText} = render(<ExternalLinkEmbed external={external} />);
      expect(getByText('example.com')).toBeTruthy();
    });

    it('renders the thumbnail image when thumb is present', () => {
      const {getByTestId} = render(<ExternalLinkEmbed external={makeExternal()} />);
      expect(getByTestId('expo-image')).toBeTruthy();
    });
  });

  describe('missing fields', () => {
    it('does not render title when title is empty', () => {
      const external = makeExternal({title: ''});
      const {queryByText} = render(<ExternalLinkEmbed external={external} />);
      // Empty string is falsy, so the title block should not render
      expect(queryByText('Test Article Title')).toBeNull();
    });

    it('does not render description when description is empty', () => {
      const external = makeExternal({description: ''});
      const {queryByText} = render(<ExternalLinkEmbed external={external} />);
      expect(queryByText('A test article description for testing purposes.')).toBeNull();
    });

    it('does not render thumbnail when thumb is undefined', () => {
      const external = makeExternal({thumb: undefined});
      const {queryByTestId} = render(<ExternalLinkEmbed external={external} />);
      expect(queryByTestId('expo-image')).toBeNull();
    });

    it('renders only domain when title and description are missing', () => {
      const external = makeExternal({title: '', description: ''});
      const {getByText, queryByTestId} = render(<ExternalLinkEmbed external={external} />);
      expect(getByText('example.com')).toBeTruthy();
      expect(queryByTestId('expo-image')).toBeTruthy();
    });

    it('falls back to raw URL when URL is invalid', () => {
      const external = makeExternal({uri: 'not-a-valid-url'});
      const {getByText} = render(<ExternalLinkEmbed external={external} />);
      expect(getByText('not-a-valid-url')).toBeTruthy();
    });
  });

  describe('tap-to-navigate interactions', () => {
    it('calls custom onPress with the URI when tapped', () => {
      const onPress = jest.fn();
      const {getByText} = render(
        <ExternalLinkEmbed external={makeExternal()} onPress={onPress} />,
      );

      fireEvent.press(getByText('Test Article Title'));
      expect(onPress).toHaveBeenCalledWith('https://example.com/article');
    });

    it('calls openLink when tapped without custom onPress', () => {
      const {getByText} = render(<ExternalLinkEmbed external={makeExternal()} />);

      fireEvent.press(getByText('Test Article Title'));
      expect(mockOpenLink).toHaveBeenCalledWith('https://example.com/article');
    });

    it('does not call openLink when custom onPress is provided', () => {
      const onPress = jest.fn();
      const {getByText} = render(
        <ExternalLinkEmbed external={makeExternal()} onPress={onPress} />,
      );

      fireEvent.press(getByText('Test Article Title'));
      expect(mockOpenLink).not.toHaveBeenCalled();
    });
  });
});
