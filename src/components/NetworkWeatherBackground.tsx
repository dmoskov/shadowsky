/**
 * NetworkWeatherBackground (Web)
 *
 * A living ambient textile behind the feed. CSS-based — uses gradients
 * and blend modes instead of Skia. Same visual language as mobile:
 * warp bands (vertical, enduring) cross weft bands (horizontal, emergent)
 * with multiply-blended crossings.
 *
 * See: docs/vision/network-weather.md
 */

import { useMemo, useEffect, useState, useRef } from "react";
import {
  WEATHER_COLORS,
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

export function NetworkWeatherBackground({ weather }: Props) {
  const isDark = document.documentElement.classList.contains("dark");
  const [pulsePhase, setPulsePhase] = useState(0);
  const rafRef = useRef<number>(0);

  // Slow pulse animation for emergence
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
    if (!weather) {
      return {
        background: "transparent",
        opacity: 0,
      };
    }

    const primary = getColor(weather.dominantHue, isDark);
    const secondary = getColor(weather.secondaryHue, isDark);
    const sameHue = weather.dominantHue === weather.secondaryHue;

    const baseOpacity = 0.06 + weather.energy * 0.06;

    // Emergence pulse: modulate opacity slightly
    const emergencePulse = hasEmergence
      ? Math.sin(pulsePhase * Math.PI * 2) * 0.02
      : 0;

    const opacity = Math.min(0.18, baseOpacity + emergencePulse);

    if (sameHue) {
      // Simple gradient (v0.1 mode)
      return {
        background: `linear-gradient(135deg, ${primary}, ${secondary})`,
        opacity,
      };
    }

    // Plaid weave: overlapping linear gradients
    // Warp: vertical bands from dominant hue
    // Weft: horizontal bands from secondary hue
    // CSS mix-blend-mode: multiply for crossing effect
    const bandAlpha = 0.5;
    const warpColor = hexToRgba(primary, bandAlpha);
    const weftColor = hexToRgba(secondary, bandAlpha);
    const transparent = "transparent";

    // Build the plaid as layered gradients
    const warpGradient = `linear-gradient(
      to right,
      ${transparent} 0%,
      ${transparent} 25%,
      ${warpColor} 30%,
      ${warpColor} 40%,
      ${transparent} 45%,
      ${transparent} 60%,
      ${warpColor} 65%,
      ${warpColor} 72%,
      ${transparent} 77%,
      ${transparent} 100%
    )`;

    const weftGradient = `linear-gradient(
      to bottom,
      ${transparent} 0%,
      ${transparent} 20%,
      ${weftColor} 25%,
      ${weftColor} 38%,
      ${transparent} 43%,
      ${transparent} 58%,
      ${weftColor} 63%,
      ${weftColor} 73%,
      ${transparent} 78%,
      ${transparent} 100%
    )`;

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
