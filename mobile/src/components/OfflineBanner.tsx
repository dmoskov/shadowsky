/**
 * Offline Banner Component
 *
 * Displays a banner at the top of the screen when the device is offline.
 * Shows "Back online" message when connection is restored.
 *
 * Features:
 * - Smooth slide down/up animations
 * - Positioned below status bar
 * - Yellow/orange background when offline
 * - Green background when back online (displays for 2 seconds)
 * - Doesn't overlap with navigation header
 */

import { useEffect, useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import {fontSize} from '../utils/typography';

interface OfflineBannerProps {
  isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const backgroundColor = useSharedValue(0); // 0 = offline (orange), 1 = online (green)
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Track previous online state to detect transitions
  useEffect(() => {
    if (!isOnline) {
      // Device went offline - show orange banner
      backgroundColor.value = 0;
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 100,
      });
    } else {
      // Check if banner is currently visible (was offline, now online)
      if (translateY.value >= 0) {
        // Show "Back online" in green for 2 seconds
        backgroundColor.value = 1;
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 100,
        });

        // Hide banner after 2 seconds
        setTimeout(() => {
          translateY.value = withTiming(-100, {
            duration: 300,
          });
        }, 2000);
      }
    }
  }, [isOnline]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    // Interpolate between offline (orange) and online (green) colors
    const bgColor =
      backgroundColor.value === 0 ? colors.warning : colors.success;
    return {
      backgroundColor: bgColor,
    };
  });

  return (
    <Animated.View
      pointerEvents={isOnline ? "none" : "auto"}
      style={[
        styles.banner,
        { paddingTop: insets.top + 8 },
        animatedStyle,
        animatedBackgroundStyle,
      ]}
    >
      <Text style={styles.bannerText}>
        {!isOnline ? "You're offline" : "Back online"}
      </Text>
    </Animated.View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    banner: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingBottom: 12,
      zIndex: 9999,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    bannerText: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
    },
  });
}
