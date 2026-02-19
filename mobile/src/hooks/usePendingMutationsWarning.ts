/**
 * Hook that shows a toast warning when the app goes to background
 * with pending offline mutations that haven't been synced yet.
 *
 * The mutation queue persists to AsyncStorage and retries on next launch,
 * but this warning helps users stay aware of unsynced actions.
 */

import {useEffect, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {mutationQueue} from '../services/mutation-queue';
import {useToast} from '../contexts/ToastContext';

export function usePendingMutationsWarning(): void {
  const {showToast} = useToast();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        // Detect transition from active to background/inactive
        if (
          appStateRef.current === 'active' &&
          (nextAppState === 'background' || nextAppState === 'inactive')
        ) {
          try {
            const stats = await mutationQueue.getStats();
            if (stats.pendingCount > 0) {
              showToast('Some actions are still syncing. Please stay online.', {
                type: 'warning',
                duration: 4000,
              });
            }
          } catch {
            // Silently ignore - queue may not be initialized
          }
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [showToast]);
}
