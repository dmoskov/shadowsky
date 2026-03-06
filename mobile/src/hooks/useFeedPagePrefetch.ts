import {useEffect, useRef} from 'react';
import {InteractionManager} from 'react-native';
import {useNetworkStatus} from './useNetworkStatus';
import {useIsScrolling} from './useScrollState';
import {useLowPowerMode} from './useLowPowerMode';

/**
 * Delay after scroll settles before prefetching the next page.
 * Scroll settle already has a 5s debounce in useScrollState, so
 * this adds a small extra delay to ensure the device is truly idle.
 */
const PREFETCH_IDLE_DELAY = 1500;

/** Minimal structural interface for any infinite feed query. */
interface InfiniteQueryLike {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  data: {pages: unknown[]} | undefined;
}

/**
 * Prefetches the next page of an infinite feed query during idle time.
 *
 * After the user stops scrolling and interactions settle, this hook
 * calls `fetchNextPage()` in the background to pre-warm the cache.
 * When the user eventually scrolls to the bottom, the next page of
 * data is already available — eliminating the pagination loading flicker.
 *
 * Prefetching is automatically skipped when:
 * - The device is in Low Power Mode
 * - The network quality is poor or offline
 * - The user is actively scrolling
 * - There is no next page to fetch
 * - A page fetch is already in progress
 *
 * Only 1 page ahead is prefetched to limit memory and network overhead.
 */
export function useFeedPagePrefetch(query: InfiniteQueryLike) {
  const {hasNextPage, isFetchingNextPage, fetchNextPage, data} = query;
  const {networkQuality} = useNetworkStatus();
  const isScrolling = useIsScrolling();
  const isLowPowerMode = useLowPowerMode();

  // Store volatile conditions in refs so the prefetch callback doesn't
  // need to be recreated on every scroll/network/battery state change.
  const networkQualityRef = useRef(networkQuality);
  networkQualityRef.current = networkQuality;
  const isScrollingRef = useRef(isScrolling);
  isScrollingRef.current = isScrolling;
  const isLowPowerModeRef = useRef(isLowPowerMode);
  isLowPowerModeRef.current = isLowPowerMode;
  const isFetchingRef = useRef(isFetchingNextPage);
  isFetchingRef.current = isFetchingNextPage;
  const hasNextPageRef = useRef(hasNextPage);
  hasNextPageRef.current = hasNextPage;
  const fetchNextPageRef = useRef(fetchNextPage);
  fetchNextPageRef.current = fetchNextPage;

  // Track the number of pages to detect when new data arrives
  const pageCount = data?.pages.length ?? 0;

  useEffect(() => {
    // Nothing to prefetch if there's no data yet or no next page
    if (pageCount === 0 || !hasNextPage) return;

    // Wait for interactions to complete, then schedule prefetch
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      // Additional idle delay after interactions settle
      const timer = setTimeout(() => {
        // Re-check all conditions at prefetch time (they may have changed)
        if (isLowPowerModeRef.current) return;
        if (
          networkQualityRef.current === 'offline' ||
          networkQualityRef.current === 'poor'
        ) {
          return;
        }
        if (isScrollingRef.current) return;
        if (isFetchingRef.current) return;
        if (!hasNextPageRef.current) return;

        fetchNextPageRef.current();
      }, PREFETCH_IDLE_DELAY);

      // Store timer on the handle for cleanup
      (interactionHandle as any)._prefetchTimer = timer;
    });

    return () => {
      interactionHandle.cancel();
      const timer = (interactionHandle as any)._prefetchTimer;
      if (timer) clearTimeout(timer);
    };
  }, [pageCount, hasNextPage]);
}
