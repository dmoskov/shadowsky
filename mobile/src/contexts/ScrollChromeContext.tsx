/**
 * ScrollChromeContext — direction-aware chrome hide/show for immersive scrolling.
 *
 * Behavior:
 * - Scrolling DOWN → chrome (header + tab bar) slides away for full-screen content
 * - Scrolling UP (reverse) → chrome slides back in
 * - Near top of list (< threshold) → chrome always visible
 * - On tab press → chrome always visible
 * - Scroll stops → chrome stays in its current state (no idle timer)
 *
 * Uses Reanimated shared values for 60fps animations driven directly from
 * the scroll handler on the UI thread. No JS-thread setState during scroll.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Minimum scroll distance before we commit to a direction change */
const DIRECTION_CHANGE_THRESHOLD = 8;

/** If scroll offset is below this, always show chrome */
const TOP_THRESHOLD = 50;

/** Animation duration for chrome show/hide */
const ANIM_DURATION = 250;

interface ScrollChromeContextValue {
  /**
   * Shared value: 0 = chrome fully visible, 1 = chrome fully hidden.
   * Screens use this to derive their own animated styles.
   */
  chromeHideProgress: SharedValue<number>;

  /**
   * Call from onScroll handler with the current contentOffset.y.
   * Determines direction and drives chromeHideProgress.
   */
  handleScroll: (y: number) => void;

  /**
   * Force chrome visible (e.g. tab press, pull-to-refresh, reaching top).
   */
  showChrome: () => void;

  /**
   * Animated style for the bottom tab bar: translateY to slide it off-screen.
   */
  tabBarAnimatedStyle: ReturnType<typeof useAnimatedStyle>;

  /**
   * The height the tab bar occupies (for content bottom padding).
   */
  tabBarHeight: number;
}

const ScrollChromeContext = createContext<ScrollChromeContextValue>({
  chromeHideProgress: { value: 0 } as SharedValue<number>,
  handleScroll: () => {},
  showChrome: () => {},
  tabBarAnimatedStyle: {} as any,
  tabBarHeight: 0,
});

export function ScrollChromeProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60 + Math.max(insets.bottom, 8);

  const chromeHideProgress = useSharedValue(0);
  const lastScrollY = useRef(0);
  const directionAnchorY = useRef(0);
  const currentDirection = useRef<"down" | "up" | null>(null);

  const showChrome = useCallback(() => {
    chromeHideProgress.value = withTiming(0, { duration: ANIM_DURATION });
    lastScrollY.current = 0;
    directionAnchorY.current = 0;
    currentDirection.current = null;
  }, [chromeHideProgress]);

  const handleScroll = useCallback(
    (y: number) => {
      const prevY = lastScrollY.current;
      lastScrollY.current = y;

      // Near top — always show
      if (y <= TOP_THRESHOLD) {
        if (chromeHideProgress.value !== 0) {
          chromeHideProgress.value = withTiming(0, { duration: ANIM_DURATION });
        }
        directionAnchorY.current = y;
        currentDirection.current = null;
        return;
      }

      const diff = y - prevY;
      if (Math.abs(diff) < 1) return; // Ignore sub-pixel

      const newDirection = diff > 0 ? "down" : "up";

      // If direction changed, set a new anchor point
      if (newDirection !== currentDirection.current) {
        directionAnchorY.current = y;
        currentDirection.current = newDirection;
      }

      // Only commit after the user has scrolled enough in the new direction
      const distFromAnchor = Math.abs(y - directionAnchorY.current);
      if (distFromAnchor < DIRECTION_CHANGE_THRESHOLD) return;

      if (newDirection === "down" && chromeHideProgress.value !== 1) {
        chromeHideProgress.value = withTiming(1, { duration: ANIM_DURATION });
      } else if (newDirection === "up" && chromeHideProgress.value !== 0) {
        chromeHideProgress.value = withTiming(0, { duration: ANIM_DURATION });
      }
    },
    [chromeHideProgress],
  );

  // Tab bar slides down off-screen
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          chromeHideProgress.value,
          [0, 1],
          [0, TAB_BAR_HEIGHT],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const value = useMemo(
    () => ({
      chromeHideProgress,
      handleScroll,
      showChrome,
      tabBarAnimatedStyle,
      tabBarHeight: TAB_BAR_HEIGHT,
    }),
    [chromeHideProgress, handleScroll, showChrome, tabBarAnimatedStyle, TAB_BAR_HEIGHT],
  );

  return (
    <ScrollChromeContext.Provider value={value}>
      {children}
    </ScrollChromeContext.Provider>
  );
}

export function useScrollChrome() {
  return useContext(ScrollChromeContext);
}

/**
 * Hook for screens to create their own header animated style.
 * Pass the total header height; returns an animated style that
 * translates the header up off-screen as chromeHideProgress goes to 1.
 */
export function useHeaderAnimatedStyle(headerHeight: number) {
  const { chromeHideProgress } = useScrollChrome();

  return useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          chromeHideProgress.value,
          [0, 1],
          [0, -headerHeight],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
}
