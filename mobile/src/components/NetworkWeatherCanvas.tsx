/**
 * NetworkWeatherCanvas
 *
 * A living ambient gradient behind the feed, driven by network sentiment
 * and energy from Pan's firehose. At rest it's barely visible — a subtle
 * warmth or coolness to the background, like the quality of light in a room.
 *
 * Uses @shopify/react-native-skia for GPU-accelerated rendering.
 *
 * See: docs/vision/network-weather.md (Layer 0: Resting State)
 */

import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  WEATHER_COLORS,
  type NetworkWeatherState,
  type WeatherHue,
} from "../services/network-weather-service";

// Conditionally import Skia — it's iOS/Android only
let Canvas: any = null;
let Rect: any = null;
let LinearGradient: any = null;
let vec: any = null;
let Blur: any = null;

try {
  const Skia = require("@shopify/react-native-skia");
  Canvas = Skia.Canvas;
  Rect = Skia.Rect;
  LinearGradient = Skia.LinearGradient;
  vec = Skia.vec;
  Blur = Skia.Blur;
} catch {
  // Skia not available (web, or module not installed)
}

interface NetworkWeatherCanvasProps {
  weather: NetworkWeatherState | null | undefined;
  /** 0-1: how revealed the weather is. 0 = resting (very subtle), 1 = full reveal */
  revealProgress?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bv = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bv})`;
}

function getHueColor(hue: WeatherHue, isDark: boolean): string {
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

export function NetworkWeatherCanvas({
  weather,
  revealProgress = 0,
}: NetworkWeatherCanvasProps) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useTheme();

  // No Skia = no render (web fallback)
  if (!Canvas || !Rect || !LinearGradient || !vec) {
    return null;
  }

  // Compute colors from weather state
  const { topColor, bottomColor, opacity } = useMemo(() => {
    if (!weather) {
      // Default: very subtle neutral
      return {
        topColor: isDark ? "rgb(15, 15, 20)" : "rgb(240, 238, 235)",
        bottomColor: isDark ? "rgb(10, 10, 15)" : "rgb(245, 243, 240)",
        opacity: 0.06,
      };
    }

    const primary = getHueColor(weather.dominantHue, isDark);
    const secondary = getHueColor(weather.secondaryHue, isDark);

    // Blend toward warmth: warm weather shifts primary toward ochre
    const warmthBlend = lerpColor(
      primary,
      getHueColor("ochre", isDark),
      weather.warmth * 0.3
    );

    // Base opacity: very subtle at rest, more visible with energy
    // Resting: 0.06-0.12. With reveal gesture: up to 0.35
    const baseOpacity = 0.06 + weather.energy * 0.06;
    const revealedOpacity = baseOpacity + revealProgress * 0.25;

    // Desaturate when conviction is low (uncertain network = greyer)
    const greyBlend = lerpColor(
      warmthBlend,
      isDark ? "rgb(30, 30, 30)" : "rgb(210, 210, 210)",
      (1 - weather.conviction) * 0.4
    );

    return {
      topColor: greyBlend,
      bottomColor: secondary,
      opacity: Math.min(0.35, revealedOpacity),
    };
  }, [weather, isDark, revealProgress]);

  return (
    <Canvas style={[styles.canvas, { width, height, opacity }]} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width * 0.3, height)}
          colors={[topColor, bottomColor]}
        />
      </Rect>
      {/* Soft blur to diffuse the gradient — makes it feel ambient, not graphic */}
      <Blur blur={40} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: -1,
  },
});
