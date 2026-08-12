/**
 * WeatherRevealOverlay
 *
 * Shown when the user pulls down on the home feed. Displays:
 * - Weather report summary line
 * - Thread labels (narrative names with colors)
 * - Tap targets for thread detail / crossing detail
 *
 * See: docs/vision/network-weather.md (Layers 2-3)
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "../contexts/ThemeContext";
import type { NetworkWeatherState, WeatherHue } from "../services/network-weather-service";
import { WEATHER_COLORS } from "../services/network-weather-service";
import { describeEmergent } from "../services/weather-report-service";

interface WeatherRevealOverlayProps {
  weather: NetworkWeatherState;
  revealProgress: number;
  onThreadPress?: (narrativeId: string, narrativeName: string) => void;
  onDismiss?: () => void;
}

function getHueColor(hue: WeatherHue, isDark: boolean): string {
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

const HUE_POOL: WeatherHue[] = [
  "indigo", "rust", "ochre", "sage", "slate", "sienna", "charcoal", "ivory",
];

function assignHue(name: string, index: number): WeatherHue {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return HUE_POOL[Math.abs(hash + index) % HUE_POOL.length];
}

export function WeatherRevealOverlay({
  weather,
  revealProgress,
  onThreadPress,
  onDismiss,
}: WeatherRevealOverlayProps) {
  const { colors, isDark } = useTheme();

  const narratives = weather.narratives?.narratives ?? [];
  const emergent = useMemo(
    () => weather.emergence?.emergentThreads?.find((t) => t.isEmergent),
    [weather],
  );
  // How many topics the headline lists; the chips below carry the full set.
  const headline = narratives.slice(0, 3);

  if (revealProgress < 0.15) return null;

  // Nothing factual to report — the ambient textile still carries the mood.
  if (!emergent && narratives.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { opacity: Math.min(1, revealProgress * 2) }]}
      pointerEvents={revealProgress > 0.5 ? "auto" : "none"}
    >
      {/* Report line — an emergent headline, or the top topics as tap targets.
          The hue lives in the colored bullet; labels stay legible in both themes. */}
      <Text
        style={[styles.report, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {emergent
          ? describeEmergent(emergent)
          : [
              "Trending:  ",
              ...headline.map((n, i) => (
                <React.Fragment key={n.id}>
                  {i > 0 ? "  ·  " : ""}
                  <Text
                    style={[styles.reportTopic, { color: colors.text }]}
                    onPress={() => onThreadPress?.(n.id, n.name)}
                  >
                    <Text
                      style={{ color: getHueColor(assignHue(n.name, i), isDark) }}
                    >
                      ●{" "}
                    </Text>
                    {n.name}
                  </Text>
                </React.Fragment>
              )),
            ]}
      </Text>

      {/* Thread labels */}
      {narratives.length > 0 && revealProgress > 0.4 && (
        <View style={styles.threadList}>
          {narratives.slice(0, 8).map((n, i) => {
            const hue = assignHue(n.name, i);
            const color = getHueColor(hue, isDark);
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.threadChip, { borderColor: color }]}
                onPress={() => onThreadPress?.(n.id, n.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.threadDot, { backgroundColor: color }]} />
                <Text
                  style={[styles.threadLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {n.name}
                </Text>
                {n.threadType === "weft" && (
                  <Text style={[styles.threadBadge, { color: colors.textTertiary }]}>
                    emergent
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Dismiss hint */}
      {revealProgress > 0.8 && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissHint}>
          <Text style={[styles.dismissText, { color: colors.textTertiary }]}>
            ↑ pull up to dismiss
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  report: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: 0.1,
    marginBottom: 12,
  },
  reportTopic: {
    fontWeight: "500",
  },
  threadList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  threadChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  threadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  threadLabel: {
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 120,
  },
  threadBadge: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dismissHint: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 11,
    fontWeight: "400",
  },
});
