import {useEffect} from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import {isIPad} from './useIsIPad';

/**
 * Unlocks all orientations when `active` is true (for fullscreen media viewing),
 * then locks back to portrait when `active` becomes false.
 *
 * On iPad this is a no-op since iPad already supports all orientations.
 */
export function useMediaOrientation(active: boolean) {
  useEffect(() => {
    if (isIPad) return;

    if (active) {
      ScreenOrientation.unlockAsync();
    } else {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    }

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, [active]);
}
