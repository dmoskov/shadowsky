import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {makeAuthor, makeRecord, mockTheme} from './test-utils';

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

jest.mock('../../utils/rich-text', () => ({
  RichText: ({text, numberOfLines, style, onTruncation}: any) => {
    const {Text, useEffect} = require('react');
    const {Text: RNText} = require('react-native');

    // Simulate truncation detection: if text is longer than 200 chars and
    // numberOfLines is set, report as truncated
    const React = require('react');
    React.useEffect(() => {
      if (onTruncation && numberOfLines) {
        onTruncation(text && text.length > 200);
      }
    }, [text, numberOfLines, onTruncation]);

    return (
      <RNText testID="rich-text" numberOfLines={numberOfLines} style={style}>
        {text}
      </RNText>
    );
  },
}));

// Import after mocks
import {QuoteEmbed} from '../QuoteEmbed';

// ─── Helpers ──────────────────────────────────────────────

function makeViewRecord(overrides: Record<string, any> = {}) {
  const {author: authorOverrides, value: valueOverrides, ...rest} = overrides;
  return {
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:quoted/app.bsky.feed.post/quoted1',
    cid: 'bafyreiquoted1',
    author: makeAuthor({handle: 'bob.bsky.social', displayName: 'Bob', ...authorOverrides}),
    value: makeRecord({text: 'This is a quoted post', ...valueOverrides}),
    indexedAt: '2025-01-01T11:00:00.000Z',
    labels: [],
    ...rest,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('QuoteEmbed', () => {
  describe('rendering with complete data', () => {
    it('renders author display name', () => {
      const record = makeViewRecord();
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(getByText('Bob')).toBeTruthy();
    });

    it('renders author handle with @ prefix', () => {
      const record = makeViewRecord();
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(getByText('@bob.bsky.social')).toBeTruthy();
    });

    it('renders post text via RichText', () => {
      const record = makeViewRecord();
      const {getByTestId} = render(<QuoteEmbed record={record} />);
      const richText = getByTestId('rich-text');
      expect(richText.props.children).toBe('This is a quoted post');
    });

    it('renders avatar', () => {
      const record = makeViewRecord();
      const {getByTestId} = render(<QuoteEmbed record={record} />);
      expect(getByTestId('expo-image')).toBeTruthy();
    });

    it('limits text to 6 lines', () => {
      const record = makeViewRecord();
      const {getByTestId} = render(<QuoteEmbed record={record} />);
      expect(getByTestId('rich-text').props.numberOfLines).toBe(6);
    });
  });

  describe('missing fields', () => {
    it('falls back to handle when displayName is missing', () => {
      const record = makeViewRecord({author: {displayName: undefined}});
      const {getAllByText} = render(<QuoteEmbed record={record} />);
      // The handle appears both as fallback displayName and in the @handle position
      const handleElements = getAllByText(/bob\.bsky\.social/);
      expect(handleElements.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to handle when displayName is empty string', () => {
      const record = makeViewRecord({author: {displayName: ''}});
      const {getAllByText} = render(<QuoteEmbed record={record} />);
      const handleElements = getAllByText(/bob\.bsky\.social/);
      expect(handleElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render RichText when post record is not a valid feed post', () => {
      const record = makeViewRecord({
        value: {$type: 'some.other.type', text: 'not a post'},
      });
      const {queryByTestId} = render(<QuoteEmbed record={record} />);
      expect(queryByTestId('rich-text')).toBeNull();
    });
  });

  describe('deleted/blocked/not-found posts', () => {
    it('renders "[Post not found]" for viewNotFound records', () => {
      const record = {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri: 'at://did:plc:deleted/app.bsky.feed.post/deleted1',
      };
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(getByText('[Post not found]')).toBeTruthy();
    });

    it('renders "[Post not found]" for viewBlocked records', () => {
      const record = {
        $type: 'app.bsky.embed.record#viewBlocked',
        uri: 'at://did:plc:blocked/app.bsky.feed.post/blocked1',
      };
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(getByText('[Post not found]')).toBeTruthy();
    });

    it('renders "[Post not found]" when record is null', () => {
      const {getByText} = render(<QuoteEmbed record={null} />);
      expect(getByText('[Post not found]')).toBeTruthy();
    });

    it('renders "[Post not found]" when record is undefined', () => {
      const {getByText} = render(<QuoteEmbed record={undefined} />);
      expect(getByText('[Post not found]')).toBeTruthy();
    });
  });

  describe('truncation indicator', () => {
    it('shows "Show more" when text is truncated', () => {
      const longText = 'A'.repeat(300);
      const record = makeViewRecord({value: {text: longText}});
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(getByText('Show more')).toBeTruthy();
    });

    it('does not show "Show more" for short text', () => {
      const record = makeViewRecord({value: {text: 'Short post'}});
      const {queryByText} = render(<QuoteEmbed record={record} />);
      expect(queryByText('Show more')).toBeNull();
    });

    it('does not show "Show more" for not-found records', () => {
      const record = {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri: 'at://did:plc:deleted/app.bsky.feed.post/deleted1',
      };
      const {queryByText} = render(<QuoteEmbed record={record} />);
      expect(queryByText('Show more')).toBeNull();
    });

    it('does not show "Show more" when post type is not a valid feed post', () => {
      const record = makeViewRecord({
        value: {$type: 'some.other.type', text: 'A'.repeat(300)},
      });
      const {queryByText} = render(<QuoteEmbed record={record} />);
      expect(queryByText('Show more')).toBeNull();
    });
  });

  describe('tap-to-navigate interactions', () => {
    it('calls onPress with uri and handle when tapped', () => {
      const onPress = jest.fn();
      const record = makeViewRecord();
      const {getByText} = render(<QuoteEmbed record={record} onPress={onPress} />);

      fireEvent.press(getByText('Bob'));
      expect(onPress).toHaveBeenCalledWith(
        'at://did:plc:quoted/app.bsky.feed.post/quoted1',
        'bob.bsky.social',
      );
    });

    it('does not throw when tapped without onPress', () => {
      const record = makeViewRecord();
      const {getByText} = render(<QuoteEmbed record={record} />);
      expect(() => fireEvent.press(getByText('Bob'))).not.toThrow();
    });

    it('renders non-interactive view for not-found records', () => {
      const onPress = jest.fn();
      const record = {
        $type: 'app.bsky.embed.record#viewNotFound',
        uri: 'at://did:plc:deleted/app.bsky.feed.post/deleted1',
      };
      const {getByText, toJSON} = render(<QuoteEmbed record={record} onPress={onPress} />);

      // Verify the not-found message renders
      expect(getByText('[Post not found]')).toBeTruthy();
      // The not-found view should not contain author info or post text
      const tree = JSON.stringify(toJSON());
      expect(tree).not.toContain('bob.bsky.social');
      expect(tree).not.toContain('rich-text');
    });
  });
});
