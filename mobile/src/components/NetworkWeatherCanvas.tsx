/**
 * NetworkWeatherCanvas
 *
 * A living ambient textile behind the feed. At rest it's barely visible —
 * a subtle warmth or coolness. As you pull down, the weave reveals itself:
 * vertical warp threads (enduring narratives) crossing horizontal weft
 * threads (emergent narratives), with multiply-blended crossings.
 *
 * Uses @shopify/react-native-skia for GPU-accelerated rendering.
 *
 * v0.1: Ambient gradient from sentiment
 * v0.2: Two-tone plaid from top narratives
 * v0.6: Emergence pulse — slow brightness wave along forming threads
 *
 * See: docs/vision/network-weather.md
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  WEATHER_COLORS,
  type NetworkWeatherState,
  type WeatherHue,
} from "../services/network-weather-service";

// Conditionally import Skia
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
  // Skia not available
}

interface NetworkWeatherCanvasProps {
  weather: NetworkWeatherState | null | undefined;
  /** 0-1: how revealed the weather is. 0 = resting, 1 = full reveal */
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

// Multiply blend: simulates how real dye crossings work in woven cloth
function multiplyColors(a: string, b: string): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round((r1 * r2) / 255)}, ${Math.round((g1 * g2) / 255)}, ${Math.round((b1 * b2) / 255)})`;
}

interface ThreadLayout {
  /** Thread bands — position and width in normalized 0-1 space */
  bands: Array<{ center: number; width: number }>;
  color: string;
}

function computeThreadLayout(
  hue: WeatherHue,
  energy: number,
  isDark: boolean,
): ThreadLayout {
  const color = getHueColor(hue, isDark);

  // Two bands per thread: a main band and a thinner accent
  // Width scales with energy
  const mainWidth = 0.08 + energy * 0.12; // 8-20% of screen
  const accentWidth = mainWidth * 0.4;

  return {
    bands: [
      { center: 0.35, width: mainWidth },
      { center: 0.7, width: accentWidth },
    ],
    color,
  };
}

// ─── Emergence Pulse ────────────────────────────────────

/** Duration of one full pulse cycle in ms (slow, like a fiber catching light) */
const PULSE_CYCLE_MS = 4000;

/**
 * Compute pulse brightness at a given phase (0-1).
 * Shape: a single soft bell curve — rises smoothly, peaks, fades back.
 * Not a sine wave — more like a single "catch" of light.
 */
function pulseWave(phase: number): number {
  // Gaussian-like: peak at 0.5, tails at 0 and 1
  const x = (phase - 0.5) * 2; // -1 to 1
  return Math.exp(-3 * x * x);
}

export function NetworkWeatherCanvas({
  weather,
  revealProgress = 0,
}: NetworkWeatherCanvasProps) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useTheme();

  // Emergence pulse animation phase (0-1, cycles slowly)
  const hasEmergence =
    weather?.emergence?.emergentThreads?.some((t) => t.isEmergent) ?? false;
  const [pulsePhase, setPulsePhase] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!hasEmergence) {
      setPulsePhase(0);
      return;
    }

    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const phase = (elapsed % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
      setPulsePhase(phase);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [hasEmergence]);

  if (!Canvas || !Rect || !vec) {
    return null;
  }

  const { elements, opacity } = useMemo(() => {
    if (!weather) {
      return { elements: null, opacity: 0.06 };
    }

    const hasNarratives = weather.dominantHue !== weather.secondaryHue;

    // Base opacity: very subtle at rest, more visible on reveal
    const baseOpacity = 0.06 + weather.energy * 0.06;
    const finalOpacity = baseOpacity + revealProgress * 0.25;

    if (!hasNarratives) {
      // v0.1 mode: simple gradient
      const primary = getHueColor(weather.dominantHue, isDark);
      const warmthShifted = lerpColor(
        primary,
        getHueColor("ochre", isDark),
        weather.warmth * 0.3,
      );
      const desaturated = lerpColor(
        warmthShifted,
        isDark ? "rgb(30, 30, 30)" : "rgb(210, 210, 210)",
        (1 - weather.conviction) * 0.4,
      );

      return {
        elements: (
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width * 0.3, height)}
              colors={[desaturated, getHueColor(weather.secondaryHue, isDark)]}
            />
          </Rect>
        ),
        opacity: Math.min(0.35, finalOpacity),
      };
    }

    // v0.2+ mode: two-tone plaid weave
    const warp = computeThreadLayout(
      weather.dominantHue,
      weather.energy,
      isDark,
    );
    const weft = computeThreadLayout(
      weather.secondaryHue,
      weather.energy,
      isDark,
    );

    // Background tint
    const bgColor = isDark ? "rgb(12, 12, 16)" : "rgb(242, 240, 237)";

    // Emergence pulse: compute brightness boost for weft bands
    const emergentThreads = weather.emergence?.emergentThreads ?? [];
    const maxPulseIntensity = emergentThreads.reduce(
      (max, t) => (t.isEmergent ? Math.max(max, t.pulseIntensity) : max),
      0,
    );
    const pulseBoost =
      maxPulseIntensity > 0 ? pulseWave(pulsePhase) * maxPulseIntensity : 0;

    // Build the plaid elements
    const warpBands = warp.bands.map((band, i) => {
      const x = band.center * width - (band.width * width) / 2;
      const w = band.width * width;
      return (
        <Rect
          key={`warp-${i}`}
          x={x}
          y={0}
          width={w}
          height={height}
          color={warp.color}
          opacity={0.5 + revealProgress * 0.3}
        />
      );
    });

    // Weft bands get the emergence pulse — a subtle brightness boost
    const weftBaseOpacity = 0.4 + revealProgress * 0.3;
    const weftPulseOpacity = weftBaseOpacity + pulseBoost * 0.2;

    const weftBands = weft.bands.map((band, i) => {
      const y = band.center * height - (band.width * height) / 2;
      const h = band.width * height;
      return (
        <Rect
          key={`weft-${i}`}
          x={0}
          y={y}
          width={width}
          height={h}
          color={weft.color}
          opacity={weftPulseOpacity}
        />
      );
    });

    // Crossings: where warp meets weft, draw a multiply-blended rect
    const crossings: React.ReactNode[] = [];
    const crossColor = multiplyColors(warp.color, weft.color);
    const crossBaseOpacity = 0.6 + revealProgress * 0.3;
    const crossPulseOpacity = crossBaseOpacity + pulseBoost * 0.15;

    for (const wb of warp.bands) {
      for (const hb of weft.bands) {
        const x = wb.center * width - (wb.width * width) / 2;
        const y = hb.center * height - (hb.width * height) / 2;
        const w = wb.width * width;
        const h = hb.width * height;
        crossings.push(
          <Rect
            key={`cross-${wb.center}-${hb.center}`}
            x={x}
            y={y}
            width={w}
            height={h}
            color={crossColor}
            opacity={crossPulseOpacity}
          />,
        );
      }
    }

    // v0.6: Emergence pulse overlay — a faint bright band that travels
    // along the weft thread, like light catching a fiber
    const emergencePulseElements: React.ReactNode[] = [];
    if (maxPulseIntensity > 0 && pulseBoost > 0.05) {
      const pulseColor = isDark ? "rgb(255, 255, 240)" : "rgb(255, 252, 235)";
      // The pulse travels horizontally across the weft band
      const pulseX = pulsePhase * width;
      const pulseWidth = width * 0.15; // 15% of screen wide "shimmer"

      for (const band of weft.bands) {
        const y = band.center * height - (band.width * height) / 2;
        const h = band.width * height;
        emergencePulseElements.push(
          <Rect
            key={`pulse-${band.center}`}
            x={pulseX - pulseWidth / 2}
            y={y}
            width={pulseWidth}
            height={h}
            color={pulseColor}
            opacity={pulseBoost * maxPulseIntensity * 0.12}
          />,
        );
      }
    }

    return {
      elements: (
        <>
          {/* Background wash */}
          <Rect x={0} y={0} width={width} height={height} color={bgColor} />
          {/* Warp (vertical) — enduring narratives */}
          {warpBands}
          {/* Weft (horizontal) — emergent narratives */}
          {weftBands}
          {/* Crossings — where communities meet */}
          {crossings}
          {/* Emergence pulse — light catching the forming fiber */}
          {emergencePulseElements}
        </>
      ),
      opacity: Math.min(0.35, finalOpacity),
    };
  }, [weather, isDark, revealProgress, width, height, pulsePhase]);

  return (
    <Canvas
      style={[styles.canvas, { width, height, opacity }]}
      pointerEvents="none"
    >
      {elements}
      <Blur blur={30} />
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
