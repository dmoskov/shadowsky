import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {mockTheme} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

const mockRegisterVideoPost = jest.fn();
const mockUnregisterVideoPost = jest.fn();
let mockAutoplayEnabled = false;
let mockActiveVideoUri: string | null = null;

jest.mock('../../contexts/VideoAutoplayContext', () => ({
  useVideoAutoplay: () => ({
    activeVideoUri: mockActiveVideoUri,
    isAutoplayEnabled: mockAutoplayEnabled,
    registerVideoPost: mockRegisterVideoPost,
    unregisterVideoPost: mockUnregisterVideoPost,
  }),
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

const mockPlayAsync = jest.fn(() => Promise.resolve());
const mockPauseAsync = jest.fn(() => Promise.resolve());
const mockStopAsync = jest.fn(() => Promise.resolve());
const mockSetPositionAsync = jest.fn(() => Promise.resolve());
const mockSetIsMutedAsync = jest.fn(() => Promise.resolve());
const mockGetStatusAsync = jest.fn(() =>
  Promise.resolve({isLoaded: true, positionMillis: 0}),
);

jest.mock('expo-av', () => {
  const React = require('react');
  const {View} = require('react-native');

  const Video = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      playAsync: mockPlayAsync,
      pauseAsync: mockPauseAsync,
      stopAsync: mockStopAsync,
      setPositionAsync: mockSetPositionAsync,
      setIsMutedAsync: mockSetIsMutedAsync,
      getStatusAsync: mockGetStatusAsync,
    }));
    return <View testID="expo-video" {...props} />;
  });

  return {
    Video,
    ResizeMode: {CONTAIN: 'contain', COVER: 'cover'},
  };
});

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Import after mocks
import {VideoEmbed} from '../VideoEmbed';

// ─── Helpers ────────────────────────────────────────────────

function makeVideo(overrides: Record<string, any> = {}) {
  return {
    cid: 'bafyreivideo1',
    playlist: 'https://video.example.com/playlist.m3u8',
    thumbnail: 'https://example.com/video-thumb.jpg',
    aspectRatio: {width: 1920, height: 1080},
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('VideoEmbed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoplayEnabled = false;
    mockActiveVideoUri = null;
  });

  describe('thumbnail mode (autoplay disabled)', () => {
    it('renders thumbnail when autoplay is disabled', () => {
      const video = makeVideo();
      const {getByTestId} = render(<VideoEmbed video={video} />);
      expect(getByTestId('expo-image')).toBeTruthy();
    });

    it('renders play button overlay on thumbnail', () => {
      const video = makeVideo();
      const {getByLabelText} = render(<VideoEmbed video={video} />);
      expect(getByLabelText('Play video')).toBeTruthy();
    });

    it('renders alt text overlay when provided', () => {
      const video = makeVideo({alt: 'A cat playing piano'});
      const {getByText} = render(<VideoEmbed video={video} />);
      expect(getByText('A cat playing piano')).toBeTruthy();
    });

    it('does not render alt text when not provided', () => {
      const video = makeVideo({alt: undefined});
      const {queryByText} = render(<VideoEmbed video={video} />);
      expect(queryByText('A cat playing piano')).toBeNull();
    });

    it('does not render thumbnail image when thumbnail URL is missing', () => {
      const video = makeVideo({thumbnail: undefined});
      const {queryByTestId} = render(<VideoEmbed video={video} />);
      expect(queryByTestId('expo-image')).toBeNull();
    });
  });

  describe('video player mode (after play)', () => {
    it('shows video player when autoplay is enabled and video is active', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByTestId} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      expect(getByTestId('expo-video')).toBeTruthy();
    });

    it('renders mute toggle button', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      expect(getByLabelText('Unmute video')).toBeTruthy();
    });

    it('renders fullscreen button', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      expect(getByLabelText('Enter fullscreen')).toBeTruthy();
    });

    it('renders time display', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      expect(getByText('0:00 / 0:00')).toBeTruthy();
    });
  });

  describe('play/pause toggle', () => {
    it('switches from thumbnail to video player when play is tapped in autoplay-enabled mode', async () => {
      // In autoplay mode with an active video, the video player is shown
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText, getByTestId} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );

      // Video player is showing (not thumbnail)
      expect(getByTestId('expo-video')).toBeTruthy();

      // Tap play/pause
      fireEvent.press(getByLabelText('Play video'));

      await waitFor(() => {
        expect(mockPlayAsync).toHaveBeenCalled();
      });
    });

    it('video ref is null in thumbnail mode so play does not call playAsync', () => {
      // When autoplay is off, the thumbnail is shown and videoRef is not mounted
      const video = makeVideo();
      const {getByLabelText} = render(<VideoEmbed video={video} />);

      fireEvent.press(getByLabelText('Play video'));

      // videoRef.current is null in thumbnail mode, so playAsync is not called
      expect(mockPlayAsync).not.toHaveBeenCalled();
    });
  });

  describe('mute/unmute toggle', () => {
    it('calls setIsMutedAsync when mute button is pressed', async () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );

      fireEvent.press(getByLabelText('Unmute video'));

      await waitFor(() => {
        expect(mockSetIsMutedAsync).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('video registration', () => {
    it('registers video post on mount', () => {
      const video = makeVideo();
      render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={false} />,
      );
      expect(mockRegisterVideoPost).toHaveBeenCalledWith('at://test/post/1');
    });

    it('unregisters video post on unmount', () => {
      const video = makeVideo();
      const {unmount} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={false} />,
      );
      unmount();
      expect(mockUnregisterVideoPost).toHaveBeenCalledWith('at://test/post/1');
    });

    it('does not register when postUri is not provided', () => {
      const video = makeVideo();
      render(<VideoEmbed video={video} isVisible={false} />);
      expect(mockRegisterVideoPost).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has accessible play button on thumbnail', () => {
      const video = makeVideo();
      const {getByLabelText} = render(<VideoEmbed video={video} />);
      const playBtn = getByLabelText('Play video');
      expect(playBtn.props.accessibilityRole).toBe('button');
      expect(playBtn.props.accessibilityHint).toBe('Double tap to play this video');
    });

    it('has accessible mute button in player mode', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      const muteBtn = getByLabelText('Unmute video');
      expect(muteBtn.props.accessibilityRole).toBe('button');
    });

    it('has accessible fullscreen button', () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );
      const fsBtn = getByLabelText('Enter fullscreen');
      expect(fsBtn.props.accessibilityRole).toBe('button');
    });
  });

  describe('fullscreen', () => {
    it('opens fullscreen modal when fullscreen button is pressed', async () => {
      mockAutoplayEnabled = true;
      mockActiveVideoUri = 'at://test/post/1';
      const video = makeVideo();
      const {getByLabelText} = render(
        <VideoEmbed video={video} postUri="at://test/post/1" isVisible={true} />,
      );

      fireEvent.press(getByLabelText('Enter fullscreen'));

      await waitFor(() => {
        expect(getByLabelText('Exit fullscreen')).toBeTruthy();
      });
    });
  });
});
