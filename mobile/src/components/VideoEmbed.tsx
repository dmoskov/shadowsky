import React, {useState, useRef, useMemo, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  StatusBar,
} from 'react-native';
import {Video, ResizeMode, AVPlaybackStatus} from 'expo-av';
import {Image} from 'expo-image';
import {AppBskyEmbedVideo} from '@atproto/api';
import {useTheme} from '../contexts/ThemeContext';
import {useVideoAutoplay} from '../contexts/VideoAutoplayContext';
import {createLogger} from '../utils/logger';
import {useMediaOrientation} from '../hooks/useMediaOrientation';
import {fontSize} from '../utils/typography';

const logger = createLogger('VideoEmbed');

interface VideoEmbedProps {
  video: AppBskyEmbedVideo.View;
  postUri?: string;
  isVisible?: boolean;
  onPress?: (url: string) => void;
}

function VideoEmbedInner({video, postUri, isVisible = false}: VideoEmbedProps) {
  const {colors} = useTheme();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, screenWidth, screenHeight), [colors, screenWidth, screenHeight]);
  const {
    activeVideoUri,
    isAutoplayEnabled,
    registerVideoPost,
    unregisterVideoPost,
  } = useVideoAutoplay();

  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useMediaOrientation(isFullscreen);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const videoRef = useRef<Video>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const manuallyPausedRef = useRef(false);

  // Register this video post with the autoplay context
  useEffect(() => {
    if (postUri) {
      registerVideoPost(postUri);
      return () => {
        unregisterVideoPost(postUri);
      };
    }
  }, [postUri, registerVideoPost, unregisterVideoPost]);

  // Determine if this video should be the active one
  const isActiveVideo = postUri != null && activeVideoUri === postUri;

  // Auto-play logic: play when visible and active, pause when not
  useEffect(() => {
    if (!videoRef.current) return;
    if (manuallyPausedRef.current) return;

    const shouldPlay = isAutoplayEnabled && isActiveVideo && isVisible;

    if (shouldPlay && !isPlaying && !hasStartedPlaying) {
      // Start auto-playing (muted)
      setIsLoading(true);
      setHasStartedPlaying(true);
      videoRef.current
        .playAsync()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(err => {
          logger.error('Auto-play failed:', err);
          setIsLoading(false);
        });
    } else if (!shouldPlay && isPlaying && !isFullscreen) {
      // Pause when scrolled out of view
      videoRef.current.pauseAsync().catch(err => logger.warn('Failed to pause video on scroll out:', err));
      setIsPlaying(false);
    }
  }, [isAutoplayEnabled, isActiveVideo, isVisible, isPlaying, hasStartedPlaying, isFullscreen]);

  // When the video scrolls completely out of view, reset state
  useEffect(() => {
    if (!isVisible && hasStartedPlaying && !isFullscreen) {
      manuallyPausedRef.current = false;
      if (videoRef.current) {
        videoRef.current.stopAsync().catch(err => logger.warn('Failed to stop video on view exit:', err));
        videoRef.current.setPositionAsync(0).catch(err => logger.warn('Failed to reset video position:', err));
      }
      setIsPlaying(false);
      setHasStartedPlaying(false);
      setIsMuted(true);
      setPosition(0);
    }
  }, [isVisible, hasStartedPlaying, isFullscreen]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setDuration(status.durationMillis ?? 0);
      setPosition(status.positionMillis ?? 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setHasStartedPlaying(false);
        manuallyPausedRef.current = false;
      }
    }
  }, []);

  // Manual play/pause toggle (tapping the video)
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    if (!hasStartedPlaying) {
      // First manual play
      setIsLoading(true);
      setHasStartedPlaying(true);
      manuallyPausedRef.current = false;
      try {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      } catch (error) {
        logger.error('Failed to play video:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (isPlaying) {
      manuallyPausedRef.current = true;
      await videoRef.current.pauseAsync().catch(err => logger.warn('Failed to pause video:', err));
      setIsPlaying(false);
    } else {
      manuallyPausedRef.current = false;
      await videoRef.current.playAsync().catch(err => logger.warn('Failed to resume video:', err));
      setIsPlaying(true);
    }
  }, [hasStartedPlaying, isPlaying]);

  // Mute/unmute toggle
  const handleMuteToggle = useCallback(async () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      await videoRef.current.setIsMutedAsync(newMuted).catch(err => logger.warn('Failed to toggle mute:', err));
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Fullscreen handling
  const handleFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    // Sync fullscreen video to current position
    if (fullscreenVideoRef.current && videoRef.current) {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded) {
        await fullscreenVideoRef.current
          .setPositionAsync(status.positionMillis)
          .catch(err => logger.warn('Failed to sync fullscreen video position:', err));
      }
    }
  }, []);

  const handleFullscreenClose = useCallback(async () => {
    // Sync position back from fullscreen video
    if (fullscreenVideoRef.current && videoRef.current) {
      const status = await fullscreenVideoRef.current.getStatusAsync();
      if (status.isLoaded) {
        await videoRef.current
          .setPositionAsync(status.positionMillis)
          .catch(err => logger.warn('Failed to sync video position from fullscreen:', err));
      }
    }
    setIsFullscreen(false);
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // If autoplay is not enabled and video hasn't been manually started, show thumbnail
  const showThumbnail = !isAutoplayEnabled && !hasStartedPlaying;

  if (showThumbnail) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.thumbnailContainer}
          onPress={handlePlayPause}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Play video"
          accessibilityHint="Double tap to play this video">
          {video.thumbnail && (
            <Image
              source={{uri: video.thumbnail}}
              style={styles.thumbnail}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={video.thumbnail}
              transition={200}
            />
          )}
          <View style={styles.playButtonContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <View style={styles.playButton}>
                <View style={styles.playIcon} />
              </View>
            )}
          </View>
          {video.alt && (
            <View style={styles.altContainer}>
              <Text style={styles.altText}>{video.alt}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={handlePlayPause}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
        accessibilityHint={
          isPlaying ? 'Double tap to pause' : 'Double tap to play'
        }>
        <Video
          ref={videoRef}
          source={{uri: video.playlist}}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          isMuted={isMuted}
          shouldPlay={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          accessibilityLabel={video.alt || 'Video'}
        />

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Controls overlay */}
        <View style={styles.controlsOverlay}>
          {/* Top row: mute toggle */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleMuteToggle}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
              accessibilityHint={`Double tap to ${isMuted ? 'unmute' : 'mute'}`}>
              <Text style={styles.controlIcon}>
                {isMuted ? '🔇' : '🔊'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Paused indicator in center */}
          {!isPlaying && hasStartedPlaying && !isLoading && (
            <View style={styles.pausedIndicator}>
              <View style={styles.playButton}>
                <View style={styles.playIcon} />
              </View>
            </View>
          )}

          {/* Bottom row: progress bar, time, fullscreen */}
          <View style={styles.bottomControls}>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {width: `${progressPercent}%`, backgroundColor: colors.primary},
                  ]}
                />
              </View>
            </View>
            <View style={styles.bottomControlsRow}>
              <Text style={styles.timeText}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleFullscreen}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                accessibilityRole="button"
                accessibilityLabel="Enter fullscreen"
                accessibilityHint="Double tap to view video in fullscreen">
                <Text style={styles.controlIcon}>⛶</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={handleFullscreenClose}>
        <StatusBar hidden={isFullscreen} />
        <View style={styles.fullscreenContainer}>
          <Video
            ref={fullscreenVideoRef}
            source={{uri: video.playlist}}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            isMuted={isMuted}
            shouldPlay={true}
            useNativeControls={true}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            accessibilityLabel={video.alt || 'Video fullscreen'}
          />
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={handleFullscreenClose}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            accessibilityRole="button"
            accessibilityLabel="Exit fullscreen">
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: any, screenWidth: number, screenHeight: number) {
  return StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      position: 'relative',
    },
    thumbnailContainer: {
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: 240,
    },
    videoContainer: {
      position: 'relative',
      width: '100%',
      height: 240,
      backgroundColor: '#000',
    },
    video: {
      width: '100%',
      height: '100%',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playButtonContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playIcon: {
      width: 0,
      height: 0,
      marginLeft: 4,
      borderLeftWidth: 20,
      borderLeftColor: '#fff',
      borderTopWidth: 12,
      borderTopColor: 'transparent',
      borderBottomWidth: 12,
      borderBottomColor: 'transparent',
    },
    controlsOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },
    topControls: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 8,
    },
    bottomControls: {
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    bottomControlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    controlButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlIcon: {
      color: '#fff',
      fontSize: fontSize.callout,
    },
    pausedIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressBarContainer: {
      width: '100%',
      height: 3,
    },
    progressBarBackground: {
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 1.5,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 1.5,
    },
    timeText: {
      color: '#fff',
      fontSize: fontSize.caption2,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 2,
    },
    altContainer: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 8,
      borderRadius: 6,
    },
    altText: {
      color: '#fff',
      fontSize: fontSize.caption1,
    },
    fullscreenContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenVideo: {
      width: screenWidth,
      height: screenHeight,
    },
    fullscreenClose: {
      position: 'absolute',
      top: 50,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenCloseText: {
      color: '#fff',
      fontSize: fontSize.headline,
      fontWeight: '600',
    },
  });
}

export const VideoEmbed = React.memo(VideoEmbedInner, (prevProps, nextProps) => {
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.postUri !== nextProps.postUri) return false;
  if (prevProps.onPress !== nextProps.onPress) return false;
  if (prevProps.video !== nextProps.video) {
    if (prevProps.video.cid !== nextProps.video.cid) return false;
    if (prevProps.video.playlist !== nextProps.video.playlist) return false;
  }
  return true;
});
