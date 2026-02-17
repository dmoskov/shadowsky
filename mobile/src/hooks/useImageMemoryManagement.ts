import {useEffect, useRef} from 'react';
import {AppState, AppStateStatus, Platform} from 'react-native';
import {Image} from 'expo-image';
import {createLogger} from '../utils/logger';

const logger = createLogger('ImageMemory');

/**
 * Manages expo-image memory cache in response to app lifecycle events.
 *
 * On iOS, decoded image bitmaps held in memory are the #1 cause of OOM kills
 * in feed-heavy social apps. This hook:
 *
 * 1. Clears the in-memory image cache when the app moves to the background,
 *    freeing decoded bitmaps while disk cache remains intact for fast reload.
 * 2. On iOS, listens for the native `memoryWarning` event and evicts the
 *    memory cache immediately to avoid being terminated by the OS.
 *
 * Place this hook once in the root layout component.
 */
export function useImageMemoryManagement() {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    // Clear memory cache when app goes to background
    const appStateSub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current === 'active' &&
          nextState.match(/inactive|background/)
        ) {
          logger.log('App backgrounded — clearing image memory cache');
          Image.clearMemoryCache();
        }
        appStateRef.current = nextState;
      },
    );

    // iOS sends a specific memory warning before killing the app
    let memorySub: ReturnType<typeof AppState.addEventListener> | null = null;
    if (Platform.OS === 'ios') {
      memorySub = AppState.addEventListener('memoryWarning', () => {
        logger.log('Memory warning received — clearing image memory cache');
        Image.clearMemoryCache();
      });
    }

    return () => {
      appStateSub.remove();
      memorySub?.remove();
    };
  }, []);
}
