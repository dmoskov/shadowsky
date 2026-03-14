/**
 * NetworkWeatherBackground (Web)
 *
 * CSS-based ambient textile behind the feed. When narrative data is
 * available from Pan, renders the full plaid with all narrative threads.
 * Falls back to two-tone plaid from trending data.
 *
 * See: docs/vision/network-weather.md
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  WEATHER_COLORS,
  type Narrative,
  type NetworkWeatherState,
  type WeatherHue,
} from "../services/network-weather";

interface Props {
  weather: NetworkWeatherState | null | undefined;
}

function getColor(hue: WeatherHue, isDark: boolean): string {
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Hue Assignment ───────────────────────────────────────

const HUE_POOL: WeatherHue[] = [
  "indigo",
  "rust",
  "ochre",
  "sage",
  "slate",
  "sienna",
  "charcoal",
  "ivory",
];

function assignHue(name: string, index: number): WeatherHue {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return HUE_POOL[Math.abs(hash + index) % HUE_POOL.length];
}

// ─── Gradient Builders ────────────────────────────────────

function buildThreadGradient(
  threads: Array<{
    position: number;
    width: number;
    color: string;
    opacity: number;
  }>,
  direction: "to right" | "to bottom",
): string {
  if (threads.length === 0) return "transparent";

  // Build gradient stops: transparent → color → transparent for each thread
  const stops: string[] = [];
  stops.push("transparent 0%");

  for (const t of threads) {
    const start = Math.max(0, (t.position - t.width / 2) * 100);
    const end = Math.min(100, (t.position + t.width / 2) * 100);
    const color = hexToRgba(t.color, t.opacity);
    stops.push(`transparent ${start.toFixed(1)}%`);
    stops.push(`${color} ${(start + 0.5).toFixed(1)}%`);
    stops.push(`${color} ${(end - 0.5).toFixed(1)}%`);
    stops.push(`transparent ${end.toFixed(1)}%`);
  }

  stops.push("transparent 100%");
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

function layoutNarrativeThreads(
  narratives: Narrative[],
  axis: "warp" | "weft",
  isDark: boolean,
  energy: number,
): Array<{ position: number; width: number; color: string; opacity: number }> {
  const filtered = narratives.filter((n) => n.threadType === axis);
  if (filtered.length === 0) return [];

  const totalWeight = filtered.reduce((s, n) => s + n.authorWeight, 0);
  const bands: Array<{
    position: number;
    width: number;
    color: string;
    opacity: number;
  }> = [];
  let cursor = 0.05;
  const available = 0.9;

  for (let i = 0; i < filtered.length; i++) {
    const n = filtered[i];
    const fraction = n.authorWeight / totalWeight;
    const width = Math.max(0.03, Math.min(0.18, fraction * available * 0.6));
    const gap =
      (available - width * filtered.length) / Math.max(1, filtered.length);
    const position = cursor + width / 2;
    const hue = assignHue(n.name, i);

    bands.push({
      position,
      width,
      color: getColor(hue, isDark),
      opacity: 0.3 + n.authorWeight * 0.4 + energy * 0.1,
    });

    cursor += width + gap;
  }

  return bands;
}

// ─── Component ────────────────────────────────────────────

export function NetworkWeatherBackground({ weather }: Props) {
  const isDark = document.documentElement.classList.contains("dark");
  const [pulsePhase, setPulsePhase] = useState(0);
  const rafRef = useRef<number>(0);

  const hasEmergence =
    weather?.emergence?.emergentThreads?.some((t) => t.isEmergent) ?? false;

  useEffect(() => {
    if (!hasEmergence) {
      setPulsePhase(0);
      return;
    }
    const start = Date.now();
    const CYCLE_MS = 8000;
    const tick = () => {
      setPulsePhase(((Date.now() - start) % CYCLE_MS) / CYCLE_MS);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hasEmergence]);

  const style = useMemo(() => {
    if (!weather) return { background: "transparent", opacity: 0 };

    const baseOpacity = 0.06 + weather.energy * 0.06;
    const emergencePulse = hasEmergence
      ? Math.sin(pulsePhase * Math.PI * 2) * 0.02
      : 0;
    const opacity = Math.min(0.18, baseOpacity + emergencePulse);
    const narrativeData = weather.narratives;

    // ── Full Textile (v0.3) ──────────────────────
    if (narrativeData && narrativeData.narratives.length >= 3) {
      const warpThreads = layoutNarrativeThreads(
        narrativeData.narratives,
        "warp",
        isDark,
        weather.energy,
      );
      const weftThreads = layoutNarrativeThreads(
        narrativeData.narratives,
        "weft",
        isDark,
        weather.energy,
      );

      const warpGradient = buildThreadGradient(warpThreads, "to right");
      const weftGradient = buildThreadGradient(weftThreads, "to bottom");

      return {
        background: `${weftGradient}, ${warpGradient}`,
        backgroundBlendMode: "multiply" as const,
        opacity,
      };
    }

    // ── Two-tone Plaid Fallback (v0.2) ───────────
    const primary = getColor(weather.dominantHue, isDark);
    const secondary = getColor(weather.secondaryHue, isDark);
    const sameHue = weather.dominantHue === weather.secondaryHue;

    if (sameHue) {
      return {
        background: `linear-gradient(135deg, ${primary}, ${secondary})`,
        opacity,
      };
    }

    const bandAlpha = 0.5;
    const warpColor = hexToRgba(primary, bandAlpha);
    const weftColor = hexToRgba(secondary, bandAlpha);

    const warpGradient = `linear-gradient(to right,
      transparent 0%, transparent 25%, ${warpColor} 30%, ${warpColor} 40%,
      transparent 45%, transparent 60%, ${warpColor} 65%, ${warpColor} 72%,
      transparent 77%, transparent 100%)`;

    const weftGradient = `linear-gradient(to bottom,
      transparent 0%, transparent 20%, ${weftColor} 25%, ${weftColor} 38%,
      transparent 43%, transparent 58%, ${weftColor} 63%, ${weftColor} 73%,
      transparent 78%, transparent 100%)`;

    return {
      background: `${weftGradient}, ${warpGradient}`,
      backgroundBlendMode: "multiply" as const,
      opacity,
    };
  }, [weather, isDark, hasEmergence, pulsePhase]);

  if (!weather) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        ...style,
        transition: "opacity 15s ease, background 15s ease",
        filter: "blur(40px)",
      }}
      aria-hidden="true"
    />
  );
}
