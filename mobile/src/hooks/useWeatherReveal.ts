/**
 * useWeatherReveal
 *
 * Manages the pull-to-reveal gesture for Network Weather.
 * Returns a revealProgress shared value (0-1) and gesture handler.
 *
 * Gesture zones:
 *   0-20px:  subtle opacity increase (glance)
 *   20-80px: progressive reveal
 *   >80px:   full reveal — feed slides down, plaid fills
 *
 * Uses react-native-reanimated for 60fps animations and
 * react-native-gesture-handler for the pan gesture.
 */

import { useCallback, useMemo } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";

const REVEAL_THRESHOLD = 80; // px to full reveal
const GLANCE_THRESHOLD = 20; // px for subtle glance
const SPRING_CONFIG = { damping: 25, stiffness: 120, mass: 0.8 };

export interface WeatherRevealState {
  /** 0-1: how revealed the weather is */
  revealProgress: { value: number };
  /** Whether fully revealed */
  isFullyRevealed: boolean;
  /** Pan gesture to attach to the feed container */
  panGesture: ReturnType<typeof Gesture.Pan>;
  /** Animated style for the feed container (slides down on reveal) */
  feedAnimatedStyle: { transform: { translateY: number }[] };
  /** Animated style for the weather overlay (opacity from progress) */
  weatherAnimatedStyle: { opacity: number };
  /** Dismiss the reveal */
  dismiss: () => void;
}

export function useWeatherReveal(enabled: boolean = true) {
  const revealProgress = useSharedValue(0);
  const isRevealed = useSharedValue(false);
  const dragY = useSharedValue(0);

  const dismiss = useCallback(() => {
    "worklet";
    revealProgress.value = withSpring(0, SPRING_CONFIG);
    isRevealed.value = false;
  }, [revealProgress, isRevealed]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY([10, 200]) // Only activate on downward drag
        .onUpdate((e) => {
          "worklet";
          if (e.translationY < 0) return; // Ignore upward drags
          dragY.value = e.translationY;
          revealProgress.value = interpolate(
            e.translationY,
            [0, GLANCE_THRESHOLD, REVEAL_THRESHOLD],
            [0, 0.15, 1],
            Extrapolation.CLAMP,
          );
        })
        .onEnd((e) => {
          "worklet";
          if (e.translationY > REVEAL_THRESHOLD * 0.6) {
            // Snap to fully revealed
            revealProgress.value = withSpring(1, SPRING_CONFIG);
            isRevealed.value = true;
          } else {
            // Snap back
            revealProgress.value = withSpring(0, SPRING_CONFIG);
            isRevealed.value = false;
          }
          dragY.value = 0;
        }),
    [enabled, revealProgress, isRevealed, dragY],
  );

  const feedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          revealProgress.value,
          [0, 1],
          [0, 200], // Feed slides down 200px at full reveal
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const weatherAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      revealProgress.value,
      [0, 0.15, 1],
      [0, 0.3, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return {
    revealProgress,
    isFullyRevealed: isRevealed.value,
    panGesture,
    feedAnimatedStyle,
    weatherAnimatedStyle,
    dismiss,
  };
}
