/**
 * Video Autoplay Context
 *
 * Manages which video in the feed is currently active (playing).
 * Only one video plays at a time to conserve memory and battery.
 * Respects user preferences for autoplay (always/wifi/never),
 * network conditions, and iOS Low Power Mode.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Platform} from 'react-native';
import {usePreferences} from './PreferencesContext';
import {useNetwork} from './NetworkContext';
import {useNetworkStatus} from '../hooks/useNetworkStatus';

interface VideoAutoplayContextType {
  /** The post URI whose video should be playing */
  activeVideoUri: string | null;
  /** Set which video should be active (called by FeedList on viewability change) */
  setActiveVideoUri: (uri: string | null) => void;
  /** Whether autoplay is currently enabled based on preferences + network + battery */
  isAutoplayEnabled: boolean;
  /** Whether the device is in low power mode */
  isLowPowerMode: boolean;
  /** Register a post URI as containing a video */
  registerVideoPost: (postUri: string) => void;
  /** Unregister a post URI (cleanup on unmount) */
  unregisterVideoPost: (postUri: string) => void;
  /** Check if a post URI has a registered video */
  hasVideo: (postUri: string) => boolean;
}

const VideoAutoplayContext = createContext<VideoAutoplayContextType | null>(null);

export function VideoAutoplayProvider({children}: {children: React.ReactNode}) {
  const {preferences} = usePreferences();
  const {connectionType} = useNetworkStatus();
  const {isOnline} = useNetwork();
  const [activeVideoUri, setActiveVideoUri] = useState<string | null>(null);
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);
  const videoPostsRef = useRef(new Set<string>());

  // Check Low Power Mode on iOS
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      // expo-battery or react-native doesn't expose Low Power Mode directly,
      // but we can check via NativeModules or a simple heuristic.
      // For now, we use ProcessInfo if available. The expo-battery package
      // exposes batteryState which includes LOW_POWER state.
      let mounted = true;
      (async () => {
        try {
          const Battery = require('expo-battery');
          if (Battery) {
            const isLowPower = await Battery.isLowPowerModeEnabledAsync();
            if (mounted) setIsLowPowerMode(isLowPower);

            // Listen for changes
            const subscription = Battery.addLowPowerModeListener(
              ({lowPowerMode}: {lowPowerMode: boolean}) => {
                if (mounted) setIsLowPowerMode(lowPowerMode);
              },
            );
            return () => {
              mounted = false;
              subscription?.remove();
            };
          }
        } catch {
          // expo-battery not available, default to false
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, []);

  // Determine if autoplay should be enabled
  const isAutoplayEnabled = useMemo(() => {
    if (!isOnline) return false;
    if (isLowPowerMode) return false;

    const autoPlaySetting = preferences?.autoPlayVideos ?? 'wifi';

    switch (autoPlaySetting) {
      case 'always':
        return true;
      case 'wifi':
        return connectionType === 'wifi';
      case 'never':
        return false;
      default:
        return false;
    }
  }, [preferences?.autoPlayVideos, connectionType, isOnline, isLowPowerMode]);

  const registerVideoPost = useCallback((postUri: string) => {
    videoPostsRef.current.add(postUri);
  }, []);

  const unregisterVideoPost = useCallback((postUri: string) => {
    videoPostsRef.current.delete(postUri);
  }, []);

  const hasVideo = useCallback((postUri: string) => {
    return videoPostsRef.current.has(postUri);
  }, []);

  const contextValue = useMemo(
    () => ({
      activeVideoUri,
      setActiveVideoUri,
      isAutoplayEnabled,
      isLowPowerMode,
      registerVideoPost,
      unregisterVideoPost,
      hasVideo,
    }),
    [
      activeVideoUri,
      isAutoplayEnabled,
      isLowPowerMode,
      registerVideoPost,
      unregisterVideoPost,
      hasVideo,
    ],
  );

  return (
    <VideoAutoplayContext.Provider value={contextValue}>
      {children}
    </VideoAutoplayContext.Provider>
  );
}

export function useVideoAutoplay() {
  const context = useContext(VideoAutoplayContext);
  if (!context) {
    throw new Error(
      'useVideoAutoplay must be used within a VideoAutoplayProvider',
    );
  }
  return context;
}
