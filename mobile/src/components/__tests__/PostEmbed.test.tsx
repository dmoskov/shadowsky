import React from 'react';
import { render } from '@testing-library/react-native';
import {
  makeImageEmbed,
  makeExternalEmbed,
  makeQuoteEmbed,
  makeVideoEmbed,
  makeRecordWithMediaEmbed,
  mockTheme,
} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('../../utils/browser', () => ({
  openLink: jest.fn(),
}));

// Mock child embed components to isolate PostEmbed logic
jest.mock('../ImageEmbed', () => ({
  ImageEmbed: ({ images }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="image-embed">
        <Text>{images?.length ?? 0} images</Text>
      </View>
    );
  },
}));

jest.mock('../ExternalLinkEmbed', () => ({
  ExternalLinkEmbed: ({ external }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="external-link-embed">
        <Text>{external?.title ?? 'no title'}</Text>
      </View>
    );
  },
}));

jest.mock('../QuoteEmbed', () => ({
  QuoteEmbed: ({ record }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="quote-embed">
        <Text>{record?.uri ?? 'no uri'}</Text>
      </View>
    );
  },
}));

jest.mock('../VideoEmbed', () => ({
  VideoEmbed: ({ video }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="video-embed">
        <Text>video</Text>
      </View>
    );
  },
}));

// Import after mocks
import { PostEmbed } from '../PostEmbed';

// ─── Tests ─────────────────────────────────────────────────
describe('PostEmbed', () => {
  it('returns null when embed is undefined', () => {
    const { toJSON } = render(<PostEmbed embed={undefined} />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when embed is null', () => {
    const { toJSON } = render(<PostEmbed embed={null as any} />);
    expect(toJSON()).toBeNull();
  });

  it('renders ImageEmbed for images', () => {
    const embed = makeImageEmbed();
    const { getByTestId, getByText } = render(<PostEmbed embed={embed as any} />);

    expect(getByTestId('image-embed')).toBeTruthy();
    expect(getByText('1 images')).toBeTruthy();
  });

  it('renders ExternalLinkEmbed for external links', () => {
    const embed = makeExternalEmbed();
    const { getByTestId, getByText } = render(<PostEmbed embed={embed as any} />);

    expect(getByTestId('external-link-embed')).toBeTruthy();
    expect(getByText('Test Article')).toBeTruthy();
  });

  it('renders QuoteEmbed for record embeds', () => {
    const embed = makeQuoteEmbed();
    const { getByTestId } = render(<PostEmbed embed={embed as any} />);

    expect(getByTestId('quote-embed')).toBeTruthy();
  });

  it('renders VideoEmbed for video embeds', () => {
    const embed = makeVideoEmbed();
    const { getByTestId } = render(<PostEmbed embed={embed as any} />);

    expect(getByTestId('video-embed')).toBeTruthy();
  });

  it('renders both media and quote for recordWithMedia', () => {
    const embed = makeRecordWithMediaEmbed();
    const { getByTestId } = render(<PostEmbed embed={embed as any} />);

    expect(getByTestId('image-embed')).toBeTruthy();
    expect(getByTestId('quote-embed')).toBeTruthy();
  });

  it('returns null for unknown embed type', () => {
    const embed = { $type: 'com.example.unknown#view' };
    const { toJSON } = render(<PostEmbed embed={embed as any} />);
    expect(toJSON()).toBeNull();
  });

  // ─── Edge cases ──────────────────────────────────────────
  describe('edge cases', () => {
    it('handles image embed with empty images array', () => {
      const embed = {
        ...makeImageEmbed(),
        images: [],
      };
      // Should still render ImageEmbed (component handles empty arrays)
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('handles external embed with missing fields', () => {
      const embed = {
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: 'https://example.com',
          title: '',
          description: '',
        },
      };
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('handles record embed with viewNotFound', () => {
      const embed = {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewNotFound',
          uri: 'at://did:plc:deleted/app.bsky.feed.post/deleted1',
        },
      };
      // Should render QuoteEmbed (it handles viewNotFound internally)
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('handles record embed with viewBlocked', () => {
      const embed = {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewBlocked',
          uri: 'at://did:plc:blocked/app.bsky.feed.post/blocked1',
        },
      };
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('handles recordWithMedia with missing media', () => {
      const embed = {
        $type: 'app.bsky.embed.recordWithMedia#view',
        media: undefined,
        record: {
          record: {
            $type: 'app.bsky.embed.record#viewRecord',
            uri: 'at://did:plc:test/app.bsky.feed.post/123',
            cid: 'bafyrei123',
            author: { did: 'did:plc:test', handle: 'test.bsky.social' },
            value: { text: 'test' },
            indexedAt: '2025-01-01T00:00:00Z',
            labels: [],
          },
        },
      };
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('handles video embed with missing thumbnail', () => {
      const embed = {
        ...makeVideoEmbed(),
        thumbnail: undefined,
      };
      expect(() => render(<PostEmbed embed={embed as any} />)).not.toThrow();
    });

    it('passes callbacks through to child components', () => {
      const onImagePress = jest.fn();
      const onLinkPress = jest.fn();
      const onQuotePress = jest.fn();
      const embed = makeImageEmbed();

      const { getByTestId } = render(
        <PostEmbed
          embed={embed as any}
          onImagePress={onImagePress}
          onLinkPress={onLinkPress}
          onQuotePress={onQuotePress}
        />
      );

      expect(getByTestId('image-embed')).toBeTruthy();
    });
  });
});
