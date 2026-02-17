import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

const mockOpenLightbox = jest.fn();
jest.mock('../../contexts/LightboxContext', () => ({
  useLightbox: () => ({openLightbox: mockOpenLightbox}),
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => (
      <View
        testID={props.testID || 'expo-image'}
        accessibilityLabel={props.accessibilityLabel}
        {...props}
      />
    ),
  };
});

jest.mock('../../utils/image-cdn', () => ({
  getOptimizedUrl: (url: string) => url,
}));

// Import after mocks
import {ImageEmbed} from '../ImageEmbed';

// ─── Helpers ────────────────────────────────────────────────

function makeImage(overrides: Record<string, any> = {}) {
  return {
    thumb: 'https://example.com/thumb.jpg',
    fullsize: 'https://example.com/full.jpg',
    alt: '',
    aspectRatio: {width: 800, height: 600},
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('ImageEmbed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('single image rendering', () => {
    it('renders a single image', () => {
      const images = [makeImage()];
      const {getAllByTestId} = render(<ImageEmbed images={images} />);
      expect(getAllByTestId('expo-image')).toHaveLength(1);
    });

    it('does not show count badge for single image', () => {
      const images = [makeImage()];
      const {queryByText} = render(<ImageEmbed images={images} />);
      expect(queryByText(/1\/1/)).toBeNull();
    });

    it('shows ALT badge when alt text is provided', () => {
      const images = [makeImage({alt: 'A sunset photo'})];
      const {getByText} = render(<ImageEmbed images={images} />);
      expect(getByText('ALT')).toBeTruthy();
    });

    it('does not show ALT badge when alt text is empty', () => {
      const images = [makeImage({alt: ''})];
      const {queryByText} = render(<ImageEmbed images={images} />);
      expect(queryByText('ALT')).toBeNull();
    });
  });

  describe('multi-image grid layouts', () => {
    it('renders two images in a double layout', () => {
      const images = [makeImage(), makeImage({thumb: 'https://example.com/thumb2.jpg'})];
      const {getAllByTestId} = render(<ImageEmbed images={images} />);
      expect(getAllByTestId('expo-image')).toHaveLength(2);
    });

    it('renders three images in a triple layout', () => {
      const images = [
        makeImage(),
        makeImage({thumb: 'https://example.com/thumb2.jpg'}),
        makeImage({thumb: 'https://example.com/thumb3.jpg'}),
      ];
      const {getAllByTestId} = render(<ImageEmbed images={images} />);
      expect(getAllByTestId('expo-image')).toHaveLength(3);
    });

    it('renders four images in a quad layout', () => {
      const images = [
        makeImage(),
        makeImage({thumb: 'https://example.com/thumb2.jpg'}),
        makeImage({thumb: 'https://example.com/thumb3.jpg'}),
        makeImage({thumb: 'https://example.com/thumb4.jpg'}),
      ];
      const {getAllByTestId} = render(<ImageEmbed images={images} />);
      expect(getAllByTestId('expo-image')).toHaveLength(4);
    });

    it('shows count badge for multiple images', () => {
      const images = [makeImage(), makeImage()];
      const {getByText} = render(<ImageEmbed images={images} />);
      expect(getByText('1/2')).toBeTruthy();
    });

    it('shows correct count for four images', () => {
      const images = [makeImage(), makeImage(), makeImage(), makeImage()];
      const {getByText} = render(<ImageEmbed images={images} />);
      expect(getByText('1/4')).toBeTruthy();
    });
  });

  describe('image tap to open lightbox', () => {
    it('opens lightbox when image is tapped and no onImagePress provided', () => {
      // Mock measureInWindow on View prototype so the ref callback works
      const mockMeasureInWindow = jest.fn((cb: Function) => cb(0, 0, 100, 100));
      jest.spyOn(
        require('react-native').View.prototype,
        'measureInWindow',
      ).mockImplementation(mockMeasureInWindow);

      const images = [makeImage({alt: 'Test alt'})];
      const {getByTestId} = render(<ImageEmbed images={images} />);

      fireEvent.press(getByTestId('expo-image'));

      expect(mockOpenLightbox).toHaveBeenCalled();
      const callArgs = mockOpenLightbox.mock.calls[0];
      // First arg: array of lightbox images
      expect(callArgs[0]).toEqual([
        {thumb: 'https://example.com/thumb.jpg', fullsize: 'https://example.com/full.jpg', alt: 'Test alt'},
      ]);
      // Second arg: index
      expect(callArgs[1]).toBe(0);
      // Third arg: source layout from measureInWindow
      expect(callArgs[2]).toEqual({x: 0, y: 0, width: 100, height: 100});

      mockMeasureInWindow.mockRestore();
    });

    it('calls onImagePress callback instead of lightbox when provided', () => {
      const onImagePress = jest.fn();
      const images = [makeImage({alt: 'Alt text'})];
      const {getByTestId} = render(
        <ImageEmbed images={images} onImagePress={onImagePress} />,
      );

      fireEvent.press(getByTestId('expo-image'));

      expect(onImagePress).toHaveBeenCalledWith(
        [{thumb: 'https://example.com/thumb.jpg', fullsize: 'https://example.com/full.jpg', alt: 'Alt text'}],
        0,
      );
      expect(mockOpenLightbox).not.toHaveBeenCalled();
    });

    it('passes correct index when tapping second image in grid', () => {
      const onImagePress = jest.fn();
      const images = [
        makeImage({thumb: 'https://example.com/thumb1.jpg'}),
        makeImage({thumb: 'https://example.com/thumb2.jpg'}),
      ];
      const {getAllByTestId} = render(
        <ImageEmbed images={images} onImagePress={onImagePress} />,
      );

      const imageElements = getAllByTestId('expo-image');
      fireEvent.press(imageElements[1]);

      expect(onImagePress).toHaveBeenCalledWith(expect.any(Array), 1);
    });
  });

  describe('aspect ratio clamping', () => {
    it('renders without crashing for very tall portrait image (narrow aspect ratio)', () => {
      const images = [makeImage({aspectRatio: {width: 100, height: 1000}})];
      expect(() => render(<ImageEmbed images={images} />)).not.toThrow();
    });

    it('renders without crashing for very wide landscape image', () => {
      const images = [makeImage({aspectRatio: {width: 2000, height: 100}})];
      expect(() => render(<ImageEmbed images={images} />)).not.toThrow();
    });

    it('renders without crashing when aspectRatio is missing', () => {
      const images = [makeImage({aspectRatio: undefined})];
      expect(() => render(<ImageEmbed images={images} />)).not.toThrow();
    });

    it('renders without crashing when aspectRatio has zero dimensions', () => {
      const images = [makeImage({aspectRatio: {width: 0, height: 0}})];
      expect(() => render(<ImageEmbed images={images} />)).not.toThrow();
    });

    it('handles square images', () => {
      const images = [makeImage({aspectRatio: {width: 500, height: 500}})];
      const {getByTestId} = render(<ImageEmbed images={images} />);
      expect(getByTestId('expo-image')).toBeTruthy();
    });
  });

  describe('blur images', () => {
    it('renders with blurImages=true without crashing', () => {
      const images = [makeImage()];
      expect(() =>
        render(<ImageEmbed images={images} blurImages={true} />),
      ).not.toThrow();
    });

    it('applies blurRadius when blurImages is true', () => {
      const images = [makeImage()];
      const {getByTestId} = render(
        <ImageEmbed images={images} blurImages={true} />,
      );
      const imageEl = getByTestId('expo-image');
      expect(imageEl.props.blurRadius).toBe(20);
    });

    it('does not apply blurRadius when blurImages is false', () => {
      const images = [makeImage()];
      const {getByTestId} = render(
        <ImageEmbed images={images} blurImages={false} />,
      );
      const imageEl = getByTestId('expo-image');
      expect(imageEl.props.blurRadius).toBe(0);
    });
  });
});
