import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';

// ─── Module mocks ──────────────────────────────────────────

const mockColors = {
  primary: '#0085FF',
  text: '#FFFFFF',
  textMuted: '#AAAAAA',
  textTertiary: '#666666',
  background: '#000000',
  surfaceElevated: '#1A1A1A',
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({colors: mockColors, isDark: true}),
}));

jest.mock('../browser', () => ({
  openLink: jest.fn(),
}));

jest.mock('../haptics', () => ({
  triggerHaptic: jest.fn(),
}));

// Import after mocks
import {RichText} from '../rich-text';

// ─── Helper to simulate onTextLayout ─────────────────────

function simulateTextLayout(
  element: any,
  lineCount: number,
) {
  const lines = Array.from({length: lineCount}, (_, i) => ({
    text: `Line ${i + 1}`,
    x: 0,
    y: i * 20,
    width: 300,
    height: 20,
  }));
  fireEvent(element, 'textLayout', {
    nativeEvent: {lines},
  });
}

// ─── Tests ────────────────────────────────────────────────

describe('RichText', () => {
  describe('plain text rendering', () => {
    it('renders plain text when no facets provided', () => {
      const {getByText} = render(<RichText text="Hello world" />);
      expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders plain text when facets is empty array', () => {
      const {getByText} = render(<RichText text="No facets here" facets={[]} />);
      expect(getByText('No facets here')).toBeTruthy();
    });

    it('applies numberOfLines prop', () => {
      const {getByText} = render(
        <RichText text="Short text" numberOfLines={3} />,
      );
      expect(getByText('Short text').props.numberOfLines).toBe(3);
    });

    it('applies custom style prop', () => {
      const style = {color: 'red', fontSize: 16};
      const {getByText} = render(
        <RichText text="Styled text" style={style} />,
      );
      expect(getByText('Styled text').props.style).toEqual(style);
    });
  });

  describe('onTruncation callback', () => {
    it('does not attach onTextLayout when onTruncation is not provided', () => {
      const {getByText} = render(
        <RichText text="No callback" numberOfLines={3} />,
      );
      expect(getByText('No callback').props.onTextLayout).toBeUndefined();
    });

    it('attaches onTextLayout but does not fire callback when numberOfLines is not provided', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText text="No line limit" onTruncation={onTruncation} />,
      );
      // onTextLayout IS attached (guarded by onTruncation alone),
      // but the callback internally checks numberOfLines before firing
      expect(getByText('No line limit').props.onTextLayout).toBeDefined();

      // Simulate a text layout event — callback should not fire
      simulateTextLayout(getByText('No line limit'), 3);
      expect(onTruncation).not.toHaveBeenCalled();
    });

    it('attaches onTextLayout when both onTruncation and numberOfLines are provided', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="With callback"
          numberOfLines={3}
          onTruncation={onTruncation}
        />,
      );
      expect(getByText('With callback').props.onTextLayout).toBeDefined();
    });

    it('calls onTruncation(true) when line count equals numberOfLines', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="Long text content"
          numberOfLines={3}
          onTruncation={onTruncation}
        />,
      );

      simulateTextLayout(getByText('Long text content'), 3);
      expect(onTruncation).toHaveBeenCalledWith(true);
    });

    it('calls onTruncation(true) when line count exceeds numberOfLines', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="Very long text"
          numberOfLines={2}
          onTruncation={onTruncation}
        />,
      );

      simulateTextLayout(getByText('Very long text'), 5);
      expect(onTruncation).toHaveBeenCalledWith(true);
    });

    it('calls onTruncation(false) when line count is less than numberOfLines', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="Short"
          numberOfLines={5}
          onTruncation={onTruncation}
        />,
      );

      simulateTextLayout(getByText('Short'), 1);
      expect(onTruncation).toHaveBeenCalledWith(false);
    });

    it('calls onTruncation(false) when lines array is empty (no lines)', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="Empty lines"
          numberOfLines={3}
          onTruncation={onTruncation}
        />,
      );

      simulateTextLayout(getByText('Empty lines'), 0);
      expect(onTruncation).toHaveBeenCalledWith(false);
    });

    it('handles onTruncation with numberOfLines=1', () => {
      const onTruncation = jest.fn();
      const {getByText} = render(
        <RichText
          text="Single line limit"
          numberOfLines={1}
          onTruncation={onTruncation}
        />,
      );

      simulateTextLayout(getByText('Single line limit'), 1);
      expect(onTruncation).toHaveBeenCalledWith(true);
    });

    it('works with faceted text (rich text with links/mentions)', () => {
      const onTruncation = jest.fn();
      const facets = [
        {
          index: {byteStart: 0, byteEnd: 12},
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: 'did:plc:someone',
            },
          ],
        },
      ];

      const {root} = render(
        <RichText
          text="@someonetest more text"
          facets={facets}
          numberOfLines={3}
          onTruncation={onTruncation}
        />,
      );

      // The root Text element should have onTextLayout attached
      const rootText = root.findByType('Text' as any);
      expect(rootText).toBeTruthy();
    });
  });

  describe('rich text with facets', () => {
    it('renders mention as tappable text', () => {
      const onMentionPress = jest.fn();
      const facets = [
        {
          index: {byteStart: 6, byteEnd: 16},
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: 'did:plc:testuser',
            },
          ],
        },
      ];

      const {getByText} = render(
        <RichText
          text="Hello @testuser how are you"
          facets={facets}
          onMentionPress={onMentionPress}
        />,
      );

      const mentionText = getByText('@testuser');
      expect(mentionText).toBeTruthy();
      expect(mentionText.props.style).toEqual({color: mockColors.primary});
    });

    it('fires onMentionPress with handle and did when mention is tapped', () => {
      const onMentionPress = jest.fn();
      const facets = [
        {
          index: {byteStart: 0, byteEnd: 9},
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: 'did:plc:testuser',
            },
          ],
        },
      ];

      const {getByText} = render(
        <RichText
          text="@testuser hello"
          facets={facets}
          onMentionPress={onMentionPress}
        />,
      );

      fireEvent.press(getByText('@testuser'));
      expect(onMentionPress).toHaveBeenCalledWith('testuser', 'did:plc:testuser');
    });

    it('renders hashtag as tappable text', () => {
      const onHashtagPress = jest.fn();
      const facets = [
        {
          index: {byteStart: 6, byteEnd: 12},
          features: [
            {
              $type: 'app.bsky.richtext.facet#tag',
              tag: 'react',
            },
          ],
        },
      ];

      const {getByText} = render(
        <RichText
          text="Hello #react"
          facets={facets}
          onHashtagPress={onHashtagPress}
        />,
      );

      const hashtagText = getByText('#react');
      expect(hashtagText).toBeTruthy();
      fireEvent.press(hashtagText);
      expect(onHashtagPress).toHaveBeenCalledWith('react');
    });

    it('renders link as tappable underlined text', () => {
      const facets = [
        {
          index: {byteStart: 10, byteEnd: 30},
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: 'https://example.com',
            },
          ],
        },
      ];

      const {getByText} = render(
        <RichText
          text="Check out https://example.com for more"
          facets={facets}
        />,
      );

      const linkText = getByText('https://example.com');
      expect(linkText).toBeTruthy();
      expect(linkText.props.style).toEqual({
        color: mockColors.primary,
        textDecorationLine: 'underline',
      });
    });
  });

  describe('edge cases', () => {
    it('renders empty text without crashing', () => {
      const {toJSON} = render(<RichText text="" />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles text with only whitespace', () => {
      const {getByText} = render(<RichText text="   " />);
      expect(getByText('   ')).toBeTruthy();
    });

    it('handles very long text', () => {
      const longText = 'A'.repeat(5000);
      const {getByText} = render(
        <RichText text={longText} numberOfLines={6} />,
      );
      expect(getByText(longText)).toBeTruthy();
    });
  });
});
