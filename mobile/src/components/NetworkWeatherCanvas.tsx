/**
 * NetworkWeatherCanvas
 *
 * A living ambient textile behind the feed. At rest barely visible.
 * When narrative data is available from Pan, renders the full plaid:
 * - Warp threads (vertical): enduring narratives
 * - Weft threads (horizontal): emergent narratives
 * - Crossings: multiply-blended where communities overlap
 * - Width proportional to author weight
 * - Crossing brightness from overlap ratio
 *
 * Falls back to two-tone plaid from trending data (v0.2) when
 * narrative data isn't available.
 *
 * Uses @shopify/react-native-skia for GPU-accelerated rendering.
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
  type Narrative,
  type NarrativeCrossing,
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
  revealProgress?: number;
}

// ─── Color Helpers ────────────────────────────────────────

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
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
}

function getHueColor(hue: WeatherHue, isDark: boolean): string {
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

function multiplyColors(a: string, b: string): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round((r1 * r2) / 255)}, ${Math.round((g1 * g2) / 255)}, ${Math.round((b1 * b2) / 255)})`;
}

// ─── Hue Assignment (by narrative name) ───────────────────

const HUE_POOL: WeatherHue[] = [
  "indigo", "rust", "ochre", "sage", "slate", "sienna", "charcoal", "ivory",
];

function assignHue(name: string, index: number): WeatherHue {
  // Simple deterministic assignment: hash the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return HUE_POOL[Math.abs(hash + index) % HUE_POOL.length];
}

// ─── Thread Layout ────────────────────────────────────────

interface ThreadBand {
  position: number; // 0-1 normalized position
  width: number;    // 0-1 normalized width
  color: string;
  narrativeId: string;
  opacity: number;
}

function layoutThreads(
  narratives: Narrative[],
  axis: "warp" | "weft",
  isDark: boolean,
  energy: number,
): ThreadBand[] {
  const filtered = narratives.filter(n => n.threadType === axis);
  if (filtered.length === 0) return [];

  const bands: ThreadBand[] = [];
  const totalWeight = filtered.reduce((s, n) => s + n.authorWeight, 0);

  // Distribute threads evenly across the axis with width proportional to weight
  let cursor = 0.05; // Start with 5% margin
  const available = 0.9; // Use 90% of axis

  for (let i = 0; i < filtered.length; i++) {
    const n = filtered[i];
    const fraction = n.authorWeight / totalWeight;
    const width = Math.max(0.03, Math.min(0.18, fraction * available * 0.6));
    const gap = (available - width * filtered.length) / Math.max(1, filtered.length);
    const position = cursor + width / 2;
    const hue = assignHue(n.name, i);

    bands.push({
      position,
      width,
      color: getHueColor(hue, isDark),
      narrativeId: n.id,
      opacity: 0.3 + n.authorWeight * 0.4 + energy * 0.1,
    });

    cursor += width + gap;
  }

  return bands;
}

// ─── Emergence Pulse ────────────────────────────────────

const PULSE_CYCLE_MS = 8000;

function pulseWave(phase: number): number {
  return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
}

// ─── Component ────────────────────────────────────────────

export function NetworkWeatherCanvas({
  weather,
  revealProgress = 0,
}: NetworkWeatherCanvasProps) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useTheme();

  if (!Canvas || !Rect || !vec) return null;

  // Emergence pulse
  const hasEmergence =
    weather?.emergence?.emergentThreads?.some((t) => t.isEmergent) ?? false;
  const [pulsePhase, setPulsePhase] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!hasEmergence) { setPulsePhase(0); return; }
    const start = Date.now();
    startRef.current = start;
    let raf: number;
    const tick = () => {
      const phase = ((Date.now() - start) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
      setPulsePhase(phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasEmergence]);

  const { elements, opacity } = useMemo(() => {
    if (!weather) return { elements: null, opacity: 0 };

    const baseOpacity = 0.06 + weather.energy * 0.06;
    const finalOpacity = baseOpacity + revealProgress * 0.25;
    const narrativeData = weather.narratives;

    // ── Full Textile (v0.3) ──────────────────────
    if (narrativeData && narrativeData.narratives.length >= 3) {
      const warpBands = layoutThreads(narrativeData.narratives, "warp", isDark, weather.energy);
      const weftBands = layoutThreads(narrativeData.narratives, "weft", isDark, weather.energy);

      const bgColor = isDark ? "rgb(12, 12, 16)" : "rgb(242, 240, 237)";

      // Build crossing lookup
      const crossingMap = new Map<string, NarrativeCrossing>();
      for (const c of narrativeData.crossings) {
        crossingMap.set(`${c.narrativeA}:${c.narrativeB}`, c);
        crossingMap.set(`${c.narrativeB}:${c.narrativeA}`, c);
      }

      const warpElements = warpBands.map((band, i) => {
        const x = band.position * width - (band.width * width) / 2;
        const w = band.width * width;
        return (
          <Rect key={`w-${i}`} x={x} y={0} width={w} height={height}
            color={band.color} opacity={band.opacity + revealProgress * 0.2} />
        );
      });

      const pulseBoost = hasEmergence ? pulseWave(pulsePhase) * 0.15 : 0;

      const weftElements = weftBands.map((band, i) => {
        const y = band.position * height - (band.width * height) / 2;
        const h = band.width * height;
        return (
          <Rect key={`h-${i}`} x={0} y={y} width={width} height={h}
            color={band.color} opacity={band.opacity + revealProgress * 0.2 + pulseBoost} />
        );
      });

      // Crossings: where warp meets weft, blend based on overlap_ratio
      const crossingElements: React.ReactNode[] = [];
      for (const wb of warpBands) {
        for (const hb of weftBands) {
          const crossing = crossingMap.get(`${wb.narrativeId}:${hb.narrativeId}`);
          if (!crossing) continue;

          const x = wb.position * width - (wb.width * width) / 2;
          const y = hb.position * height - (hb.width * height) / 2;
          const w = wb.width * width;
          const h = hb.width * height;
          const crossColor = multiplyColors(wb.color, hb.color);
          // Brighter crossings where more authors overlap
          const crossOpacity = 0.3 + crossing.overlapRatio * 0.5 + revealProgress * 0.2;

          crossingElements.push(
            <Rect key={`c-${wb.narrativeId}-${hb.narrativeId}`}
              x={x} y={y} width={w} height={h}
              color={crossColor} opacity={crossOpacity} />
          );
        }
      }

      return {
        elements: (
          <>
            <Rect x={0} y={0} width={width} height={height} color={bgColor} />
            {warpElements}
            {weftElements}
            {crossingElements}
          </>
        ),
        opacity: Math.min(0.35, finalOpacity),
      };
    }

    // ── Two-tone Plaid Fallback (v0.2) ───────────
    const hasNarratives = weather.dominantHue !== weather.secondaryHue;

    if (!hasNarratives) {
      // Simple gradient (v0.1)
      const primary = getHueColor(weather.dominantHue, isDark);
      const warmthShifted = lerpColor(primary, getHueColor("ochre", isDark), weather.warmth * 0.3);
      const desaturated = lerpColor(warmthShifted, isDark ? "rgb(30,30,30)" : "rgb(210,210,210)", (1 - weather.conviction) * 0.4);

      return {
        elements: (
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient start={vec(0, 0)} end={vec(width * 0.3, height)}
              colors={[desaturated, getHueColor(weather.secondaryHue, isDark)]} />
          </Rect>
        ),
        opacity: Math.min(0.35, finalOpacity),
      };
    }

    // Two-tone plaid (v0.2)
    const warpColor = getHueColor(weather.dominantHue, isDark);
    const weftColor = getHueColor(weather.secondaryHue, isDark);
    const bgColor = isDark ? "rgb(12, 12, 16)" : "rgb(242, 240, 237)";
    const crossColor = multiplyColors(warpColor, weftColor);
    const bandW = 0.08 + weather.energy * 0.12;
    const pulseBoost = hasEmergence ? pulseWave(pulsePhase) * 0.15 : 0;

    return {
      elements: (
        <>
          <Rect x={0} y={0} width={width} height={height} color={bgColor} />
          <Rect x={0.35 * width - bandW * width / 2} y={0} width={bandW * width} height={height}
            color={warpColor} opacity={0.5 + revealProgress * 0.3} />
          <Rect x={0.7 * width - bandW * 0.4 * width / 2} y={0} width={bandW * 0.4 * width} height={height}
            color={warpColor} opacity={0.4 + revealProgress * 0.3} />
          <Rect x={0} y={0.35 * height - bandW * height / 2} width={width} height={bandW * height}
            color={weftColor} opacity={0.4 + revealProgress * 0.3 + pulseBoost} />
          <Rect x={0} y={0.7 * height - bandW * 0.4 * height / 2} width={width} height={bandW * 0.4 * height}
            color={weftColor} opacity={0.35 + revealProgress * 0.3 + pulseBoost} />
          <Rect x={0.35 * width - bandW * width / 2} y={0.35 * height - bandW * height / 2}
            width={bandW * width} height={bandW * height}
            color={crossColor} opacity={0.6 + revealProgress * 0.3} />
        </>
      ),
      opacity: Math.min(0.35, finalOpacity),
    };
  }, [weather, isDark, revealProgress, width, height, hasEmergence, pulsePhase]);

  return (
    <Canvas style={[styles.canvas, { width, height, opacity }]} pointerEvents="none">
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
