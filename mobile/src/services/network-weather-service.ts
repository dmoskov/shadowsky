/**
 * Network Weather Service
 *
 * Fetches sentiment and energy signals from Pan to drive the ambient
 * textile background. Falls back to a gentle neutral state when
 * Pan is unreachable.
 *
 * See: docs/vision/network-weather.md
 */

import { fetchWithTimeout } from "../utils/with-timeout";
import { createLogger } from "../utils/logger";

const logger = createLogger("NetworkWeather");

const PAN_API_URLS = [
  "https://api.asphodel.is",
  "https://api.shadowsky.io",
];

export const WEATHER_CACHE_TTL = 5 * 60 * 1000; // 5 min

// ─── Types ────────────────────────────────────────────────

export interface NetworkWeatherState {
  /** 0-1: overall warmth (0 = cool/analytical, 1 = warm/communal) */
  warmth: number;
  /** 0-1: overall energy (0 = quiet, 1 = high activity) */
  energy: number;
  /** 0-1: overall conviction (0 = uncertain/grey, 1 = strongly held) */
  conviction: number;
  /** Dominant hue name for the palette */
  dominantHue: WeatherHue;
  /** Secondary hue (for gradient blend) */
  secondaryHue: WeatherHue;
  /** Data source */
  source: "pan" | "fallback";
  /** When this was computed */
  timestamp: number;
}

export type WeatherHue =
  | "ochre"    // communal, celebratory
  | "rust"     // creative, cultural
  | "indigo"   // analytical, technical
  | "sage"     // growth, learning
  | "slate"    // structural, political
  | "sienna"   // personal, intimate
  | "charcoal" // conflict, contested
  | "ivory";   // meta, reflective

// ─── Color Palette (natural dye colors) ───────────────────

export const WEATHER_COLORS: Record<WeatherHue, { dark: string; light: string }> = {
  ochre:    { dark: "#C4973B", light: "#E8D5A3" },
  rust:     { dark: "#A0522D", light: "#D4967A" },
  indigo:   { dark: "#3B4F8A", light: "#8B9FCC" },
  sage:     { dark: "#6B8F6B", light: "#A8C5A8" },
  slate:    { dark: "#5A6B7A", light: "#94A3B3" },
  sienna:   { dark: "#8B5E3C", light: "#C4A07A" },
  charcoal: { dark: "#4A4A4A", light: "#8A8A8A" },
  ivory:    { dark: "#B8B0A0", light: "#E8E2D8" },
};

// ─── Default State ────────────────────────────────────────

const DEFAULT_STATE: NetworkWeatherState = {
  warmth: 0.5,
  energy: 0.3,
  conviction: 0.4,
  dominantHue: "slate",
  secondaryHue: "sage",
  source: "fallback",
  timestamp: Date.now(),
};

// ─── Pan Fetch ────────────────────────────────────────────

interface PanSentiment {
  overall_sentiment?: number;     // -1 to 1
  sentiment_variance?: number;    // 0 to 1
  volume_ratio?: number;          // relative to baseline
  dominant_category?: string;
}

async function fetchPanSentiment(): Promise<PanSentiment | null> {
  for (const baseUrl of PAN_API_URLS) {
    try {
      const resp = await fetchWithTimeout(
        `${baseUrl}/api/sentiment/latest`,
        { headers: { Accept: "application/json" } },
        5000
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      return data?.data || data;
    } catch {
      continue;
    }
  }
  return null;
}

interface PanTrendingTopic {
  token: string;
  trend_score: number;
  metrics: {
    hourly_count: number;
    hourly_unique_authors: number;
    count_ratio: number;
    engagement_ratio: number;
    author_diversity_ratio: number;
  };
}

async function fetchPanTrending(): Promise<PanTrendingTopic[]> {
  for (const baseUrl of PAN_API_URLS) {
    try {
      const resp = await fetchWithTimeout(
        `${baseUrl}/api/trending/topics?limit=5&hours=6`,
        { headers: { Accept: "application/json" } },
        5000
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      return data?.data?.topics || [];
    } catch {
      continue;
    }
  }
  return [];
}

// ─── Hue Classification ──────────────────────────────────

function classifyHue(category?: string, sentiment?: number, variance?: number): WeatherHue {
  if (!category) {
    // Derive from sentiment + variance
    if (variance != null && variance > 0.6) return "charcoal";
    if (sentiment != null && sentiment > 0.3) return "ochre";
    if (sentiment != null && sentiment < -0.3) return "slate";
    return "sage";
  }

  const cat = category.toLowerCase();
  if (cat.includes("tech") || cat.includes("code") || cat.includes("science")) return "indigo";
  if (cat.includes("art") || cat.includes("music") || cat.includes("creative")) return "rust";
  if (cat.includes("politic") || cat.includes("govern") || cat.includes("policy")) return "slate";
  if (cat.includes("personal") || cat.includes("story") || cat.includes("support")) return "sienna";
  if (cat.includes("learn") || cat.includes("education") || cat.includes("question")) return "sage";
  if (cat.includes("meta") || cat.includes("platform") || cat.includes("bluesky")) return "ivory";
  if (cat.includes("celebrat") || cat.includes("communit")) return "ochre";
  return "sage";
}

// ─── Main Fetch ──────────────────────────────────────────

export async function fetchNetworkWeather(): Promise<NetworkWeatherState> {
  try {
    const [sentiment, trending] = await Promise.all([
      fetchPanSentiment(),
      fetchPanTrending(),
    ]);

    if (!sentiment && trending.length === 0) {
      return { ...DEFAULT_STATE, timestamp: Date.now() };
    }

    // Warmth: from sentiment (-1..1 → 0..1)
    const rawSentiment = sentiment?.overall_sentiment ?? 0;
    const warmth = Math.max(0, Math.min(1, (rawSentiment + 1) / 2));

    // Energy: from volume ratio and trending count
    const volumeRatio = sentiment?.volume_ratio ?? 1;
    const avgCountRatio = trending.length > 0
      ? trending.reduce((s, t) => s + t.metrics.count_ratio, 0) / trending.length
      : 1;
    const energy = Math.max(0, Math.min(1, (Math.log2(volumeRatio * avgCountRatio) + 1) / 4));

    // Conviction: inverse of variance (high variance = uncertain)
    const variance = sentiment?.sentiment_variance ?? 0.5;
    const conviction = Math.max(0, Math.min(1, 1 - variance));

    // Hues from top trending topics
    const dominantHue = classifyHue(
      sentiment?.dominant_category,
      rawSentiment,
      variance
    );

    // Secondary hue: derive from second trending topic
    // Use the velocity pattern to pick a contrasting hue
    let secondaryHue: WeatherHue;
    if (trending.length >= 2) {
      const secondTopic = trending[1];
      const ratio = secondTopic.metrics.count_ratio;
      // High velocity emergent topics get warmer hues
      if (ratio > 3) secondaryHue = "rust";
      else if (ratio > 1.5) secondaryHue = "ochre";
      else secondaryHue = "sage";
      // Avoid matching the dominant hue
      if (secondaryHue === dominantHue) {
        secondaryHue = dominantHue === "sage" ? "indigo" : "sage";
      }
    } else {
      secondaryHue = dominantHue === "sage" ? "indigo" : "sage";
    }

    return {
      warmth,
      energy,
      conviction,
      dominantHue,
      secondaryHue,
      source: "pan",
      timestamp: Date.now(),
    };
  } catch (error) {
    logger.warn("Failed to fetch network weather:", error);
    return { ...DEFAULT_STATE, timestamp: Date.now() };
  }
}
