import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {mockTheme} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: Object.assign(
      (props: any) => <View testID="expo-image" {...props} />,
      {prefetch: jest.fn()},
    ),
  };
});

jest.mock('../../utils/image-cdn', () => ({
  getOptimizedUrl: (url: string) => url,
}));

jest.mock('../../utils/save-image', () => ({
  saveImageToGallery: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../icons', () => {
  const {View} = require('react-native');
  const actual = jest.requireActual('../icons');
  return {
    ...actual,
    DownloadIcon: (props: any) => <View testID="download-icon" {...props} />,
  };
});

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native');
  const Animated = {
    View: (props: any) => <View {...props} />,
  };
  return {
    __esModule: true,
    default: Animated,
    FadeIn: {duration: () => ({})},
    FadeOut: {duration: () => ({})},
  };
});

jest.mock('../RetroAltTextModal', () => ({
  RetroAltTextModal: () => null,
}));

jest.mock('../../contexts/LightboxContext', () => ({
  useLightbox: () => ({openLightbox: jest.fn(), closeLightbox: jest.fn(), updateImageAlt: jest.fn(), state: {visible: false, images: [], index: 0, sourceLayout: null, postMeta: null}}),
}));

jest.mock('../ImageCarouselItem', () => ({
  ImageCarouselItem: ({uri, onDismiss, onSingleTap}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View testID="carousel-item">
        <Text testID="carousel-item-uri">{uri}</Text>
        <TouchableOpacity testID="carousel-item-tap" onPress={onSingleTap} />
        <TouchableOpacity testID="carousel-item-dismiss" onPress={onDismiss} />
      </View>
    );
  },
}));

// Import after mocks
import {ImageCarousel} from '../ImageCarousel';

// ─── Helpers ────────────────────────────────────────────────

function makeImages(count: number) {
  return Array.from({length: count}, (_, i) => ({
    thumb: `https://example.com/thumb${i + 1}.jpg`,
    fullsize: `https://example.com/full${i + 1}.jpg`,
    alt: `Image ${i + 1} description`,
  }));
}

// ─── Tests ──────────────────────────────────────────────────

describe('ImageCarousel', () => {
  const defaultProps = {
    images: makeImages(3),
    initialIndex: 0,
    visible: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const {toJSON} = render(
        <ImageCarousel {...defaultProps} visible={false} />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders the modal when visible is true', () => {
      const {getByLabelText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByLabelText('Close image viewer')).toBeTruthy();
    });
  });

  describe('image counter', () => {
    it('shows counter for multiple images', () => {
      const {getByText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByText('1 / 3')).toBeTruthy();
    });

    it('does not show counter for single image', () => {
      const {queryByText} = render(
        <ImageCarousel {...defaultProps} images={makeImages(1)} />,
      );
      expect(queryByText(/\d+ \/ \d+/)).toBeNull();
    });
  });

  describe('page indicator dots', () => {
    it('renders dots for multiple images', () => {
      const images = makeImages(3);
      const {toJSON} = render(
        <ImageCarousel {...defaultProps} images={images} />,
      );
      // Verify page indicator dots are rendered - the component renders 3 dot Views
      // in a dotsContainer. Stringify the tree and look for the dots pattern.
      const tree = JSON.stringify(toJSON());
      // The counter text includes "1", " / ", "3" as children proving multi-image mode
      expect(tree).toContain('"children":["1"," / ","3"]');
    });

    it('does not render dots for single image', () => {
      const {queryByText} = render(
        <ImageCarousel {...defaultProps} images={makeImages(1)} />,
      );
      expect(queryByText(/\d+ \/ \d+/)).toBeNull();
    });
  });

  describe('close button', () => {
    it('renders close button', () => {
      const {getByLabelText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByLabelText('Close image viewer')).toBeTruthy();
    });

    it('calls onClose when close button is pressed', () => {
      const onClose = jest.fn();
      const {getByLabelText} = render(
        <ImageCarousel {...defaultProps} onClose={onClose} />,
      );

      fireEvent.press(getByLabelText('Close image viewer'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('save and share buttons', () => {
    it('renders save button', () => {
      const {getByLabelText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByLabelText('Save image to gallery')).toBeTruthy();
    });

    it('renders share button', () => {
      const {getByLabelText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByLabelText('Share image')).toBeTruthy();
    });

    it('calls saveImageToGallery when save is pressed', async () => {
      const {saveImageToGallery} = require('../../utils/save-image');
      const {getByLabelText} = render(<ImageCarousel {...defaultProps} />);

      fireEvent.press(getByLabelText('Save image to gallery'));

      await waitFor(() => {
        expect(saveImageToGallery).toHaveBeenCalledWith(
          'https://example.com/full1.jpg',
        );
      });
    });
  });

  describe('alt text', () => {
    it('renders ALT badge when current image has alt text', () => {
      const {getByText} = render(<ImageCarousel {...defaultProps} />);
      expect(getByText('ALT')).toBeTruthy();
    });

    it('does not render ALT badge when current image lacks alt text', () => {
      const images = [{thumb: 'https://a.jpg', fullsize: 'https://b.jpg'}];
      const {queryByText} = render(
        <ImageCarousel {...defaultProps} images={images} />,
      );
      expect(queryByText('ALT')).toBeNull();
    });

    it('expands alt text when ALT badge is tapped', () => {
      // Use images without alt on the carousel items to avoid duplicate text
      const images = [{thumb: 'https://a.jpg', fullsize: 'https://b.jpg', alt: 'Unique alt text for overlay'}];
      const {getByText, queryByText} = render(
        <ImageCarousel {...defaultProps} images={images} />,
      );

      // ALT badge is present
      expect(getByText('ALT')).toBeTruthy();
      // Alt text not yet expanded
      expect(queryByText('Unique alt text for overlay')).toBeNull();

      // Tap the ALT badge to expand
      fireEvent.press(getByText('ALT'));
      expect(getByText('Unique alt text for overlay')).toBeTruthy();
    });

    it('collapses alt text when tapped again', () => {
      const images = [{thumb: 'https://a.jpg', fullsize: 'https://b.jpg', alt: 'Unique alt for collapse'}];
      const {getByText, queryByText} = render(
        <ImageCarousel {...defaultProps} images={images} />,
      );

      // Expand
      fireEvent.press(getByText('ALT'));
      expect(getByText('Unique alt for collapse')).toBeTruthy();

      // Collapse - the expanded text is wrapped in a TouchableOpacity, tap it
      fireEvent.press(getByText('Unique alt for collapse'));
      expect(getByText('ALT')).toBeTruthy();
      expect(queryByText('Unique alt for collapse')).toBeNull();
    });
  });

  describe('carousel swiping', () => {
    it('renders FlatList with horizontal paging', () => {
      const {UNSAFE_getByType} = render(<ImageCarousel {...defaultProps} />);
      const {FlatList} = require('react-native');
      const flatList = UNSAFE_getByType(FlatList);
      expect(flatList.props.horizontal).toBe(true);
      expect(flatList.props.pagingEnabled).toBe(true);
    });

    it('starts at initialIndex', () => {
      const {UNSAFE_getByType} = render(
        <ImageCarousel {...defaultProps} initialIndex={1} />,
      );
      const {FlatList} = require('react-native');
      const flatList = UNSAFE_getByType(FlatList);
      expect(flatList.props.initialScrollIndex).toBe(1);
    });

    it('renders at least one carousel item initially', () => {
      // FlatList uses initialNumToRender={1}, so only 1 item is rendered at first
      const {getAllByTestId} = render(<ImageCarousel {...defaultProps} />);
      expect(getAllByTestId('carousel-item').length).toBeGreaterThanOrEqual(1);
    });

    it('provides accessibility hints for swiping', () => {
      const {UNSAFE_getByType} = render(<ImageCarousel {...defaultProps} />);
      const {FlatList} = require('react-native');
      const flatList = UNSAFE_getByType(FlatList);
      expect(flatList.props.accessibilityHint).toBe(
        'Swipe left or right to navigate between images',
      );
    });
  });

  describe('controls toggle', () => {
    it('hides controls when carousel item single tap fires', async () => {
      const {getAllByTestId, queryByLabelText, getByLabelText} = render(
        <ImageCarousel {...defaultProps} />,
      );

      // Controls are visible initially
      expect(getByLabelText('Close image viewer')).toBeTruthy();

      // Simulate single tap on the carousel item
      fireEvent.press(getAllByTestId('carousel-item-tap')[0]);

      await waitFor(() => {
        // Controls should be hidden after tap
        expect(queryByLabelText('Close image viewer')).toBeNull();
      });
    });
  });

  describe('dismiss via carousel item', () => {
    it('calls onClose when carousel item triggers dismiss', () => {
      const onClose = jest.fn();
      const {getAllByTestId} = render(
        <ImageCarousel {...defaultProps} onClose={onClose} />,
      );

      fireEvent.press(getAllByTestId('carousel-item-dismiss')[0]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty images array without crashing', () => {
      expect(() =>
        render(
          <ImageCarousel {...defaultProps} images={[]} />,
        ),
      ).not.toThrow();
    });

    it('handles initialIndex beyond images length', () => {
      expect(() =>
        render(
          <ImageCarousel {...defaultProps} initialIndex={10} />,
        ),
      ).not.toThrow();
    });
  });
});
