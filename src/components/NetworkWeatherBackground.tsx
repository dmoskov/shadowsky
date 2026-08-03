/**
 * NetworkWeatherBackground (Web)
 *
 * CSS-based ambient textile behind the feed. When narrative data is
 * available from Pan, renders the full plaid with all narrative threads.
 * Falls back to two-tone plaid from trending data.
 *
 * Ambient *color*, never ambient *motion*: this renders a static wash that
 * only changes when Pan ships new data. Emergence used to drive a 60fps
 * requestAnimationFrame opacity pulse; it is now expressed as added colour
 * presence instead, so nothing behind the feed ever breathes or shimmers.
 *
 * See: docs/vision/network-weather.md
 */

import { useMemo } from "react";
import {
  weatherColor,
  weatherColorWithAlpha,
  type Narrative,
  type NetworkWeatherState,
  type WeatherHue,
} from "../services/network-weather";

interface Props {
  weather: NetworkWeatherState | null | undefined;
}

// ─── Presence ─────────────────────────────────────────────

// How much of the wash is visible. Kept low enough to stay behind text at all
// times, but wide enough that "quiet" and "busy" actually look different.
const OPACITY_FLOOR = 0.05;
const OPACITY_CEILING = 0.11;

// Emergence reads as a little extra colour, not as movement.
const EMERGENCE_PRESENCE = 0.02;

// Presence used when energy is unmeasured — a third of the way up the range,
// so the wash still shows without claiming the network is at full tilt.
const UNKNOWN_ENERGY_PRESENCE = (OPACITY_CEILING - OPACITY_FLOOR) / 3;

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

/** Thread bands carry a pre-resolved hex plus a per-band weight. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substring(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
    const color = withAlpha(t.color, t.opacity);
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
      color: weatherColor(hue, isDark),
      opacity: 0.3 + n.authorWeight * 0.4 + energy * 0.1,
    });

    cursor += width + gap;
  }

  return bands;
}

// ─── Component ────────────────────────────────────────────

export function NetworkWeatherBackground({ weather }: Props) {
  const isDark = document.documentElement.classList.contains("dark");

  const hasEmergence =
    weather?.emergence?.emergentThreads?.some((t) => t.isEmergent) ?? false;

  const style = useMemo(() => {
    if (!weather) return { background: "transparent", opacity: 0 };

    // Energy and emergence both read as colour presence. The previous clamp
    // (Math.min(0.07, ...)) collapsed every energy above ~0.17 to an identical
    // value, so the whole energy signal was invisible; this maps the full
    // range instead. Emergence adds a flat step rather than a pulse.
    //
    // When energy is a placeholder rather than a measurement, sit at a modest
    // fixed presence: pinning the wash to the ceiling would read as "maximum
    // activity" on the strength of a number that means nothing.
    const energyPresence = weather.energyReliable
      ? weather.energy * (OPACITY_CEILING - OPACITY_FLOOR)
      : UNKNOWN_ENERGY_PRESENCE;
    const opacity =
      OPACITY_FLOOR + energyPresence + (hasEmergence ? EMERGENCE_PRESENCE : 0);
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
    const primary = weather.dominantHue;
    const secondary = weather.secondaryHue;
    const sameHue = weather.dominantHue === weather.secondaryHue;

    if (sameHue) {
      const flat = weatherColor(primary, isDark);
      return {
        background: `linear-gradient(135deg, ${flat}, ${flat})`,
        opacity,
      };
    }

    const bandAlpha = 0.5;
    const warpColor = weatherColorWithAlpha(primary, isDark, bandAlpha);
    const weftColor = weatherColorWithAlpha(secondary, isDark, bandAlpha);

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
  }, [weather, isDark, hasEmergence]);

  if (!weather) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 motion-safe:transition-[opacity,background] motion-safe:duration-[15s] motion-safe:ease-out"
      style={{
        ...style,
        filter: "blur(80px)",
      }}
      aria-hidden="true"
    />
  );
}
