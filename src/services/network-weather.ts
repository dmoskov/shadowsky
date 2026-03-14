/**
 * Network Weather Service (Web)
 *
 * Fetches sentiment and energy signals from Pan to drive the ambient
 * textile background. Shared logic with mobile, adapted for web.
 *
 * See: docs/vision/network-weather.md
 */

const PAN_API_URLS = [
  "https://api.asphodel.is",
  "https://api.shadowsky.io",
];

export const WEATHER_CACHE_TTL = 5 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────

export type WeatherHue =
  | "ochre"
  | "rust"
  | "indigo"
  | "sage"
  | "slate"
  | "sienna"
  | "charcoal"
  | "ivory";

export interface NetworkWeatherState {
  warmth: number;
  energy: number;
  conviction: number;
  dominantHue: WeatherHue;
  secondaryHue: WeatherHue;
  source: "pan" | "fallback";
  timestamp: number;
  emergence: EmergenceState | null;
}

export interface EmergentThread {
  token: string;
  ageMinutes: number;
  countRatio: number;
  isEmergent: boolean;
  pulseIntensity: number;
}

export interface EmergenceState {
  emergentThreads: EmergentThread[];
  timestamp: number;
}

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

// ─── Pan API Types ────────────────────────────────────────

interface PanSentiment {
  overall_sentiment?: number;
  sentiment_variance?: number;
  volume_ratio?: number;
  dominant_category?: string;
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

// ─── Fetch Helpers ────────────────────────────────────────

async function fetchPan(path: string): Promise<any> {
  for (const baseUrl of PAN_API_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      return await resp.json();
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Hue Classification ──────────────────────────────────

function classifyHue(
  category?: string,
  sentiment?: number,
  variance?: number,
): WeatherHue {
  if (!category) {
    if (variance != null && variance > 0.6) return "charcoal";
    if (sentiment != null && sentiment > 0.3) return "ochre";
    if (sentiment != null && sentiment < -0.3) return "slate";
    return "sage";
  }
  const cat = category.toLowerCase();
  if (cat.includes("tech") || cat.includes("code") || cat.includes("science")) return "indigo";
  if (cat.includes("art") || cat.includes("music") || cat.includes("creative")) return "rust";
  if (cat.includes("politic") || cat.includes("govern")) return "slate";
  if (cat.includes("personal") || cat.includes("story")) return "sienna";
  if (cat.includes("learn") || cat.includes("education")) return "sage";
  if (cat.includes("meta") || cat.includes("platform")) return "ivory";
  if (cat.includes("celebrat") || cat.includes("communit")) return "ochre";
  return "sage";
}

// ─── Emergence Detection (in-memory) ─────────────────────

const previousSnapshots = new Map<string, { timestamp: number; countRatio: number }>();

function detectEmergence(topics: PanTrendingTopic[]): EmergenceState {
  const now = Date.now();
  const emergentThreads: EmergentThread[] = [];

  for (const topic of topics) {
    const prev = previousSnapshots.get(topic.token);
    const isNew = !prev || (now - prev.timestamp > 2 * 60 * 60 * 1000);
    const isGrowing = topic.metrics.count_ratio > 3;
    const isOrganic = topic.metrics.author_diversity_ratio > 1.5;
    const isEmergent = isNew && isGrowing && isOrganic;

    const ageMinutes = prev ? Math.round((now - prev.timestamp) / 60000) : 0;
    const pulseIntensity = isEmergent
      ? Math.min(1, (topic.metrics.count_ratio - 3) / 5 * (topic.metrics.author_diversity_ratio - 1) / 2)
      : 0;

    if (isEmergent || (isNew && isGrowing)) {
      emergentThreads.push({
        token: topic.token,
        ageMinutes,
        countRatio: topic.metrics.count_ratio,
        isEmergent,
        pulseIntensity,
      });
    }

    previousSnapshots.set(topic.token, {
      timestamp: prev?.timestamp ?? now,
      countRatio: topic.metrics.count_ratio,
    });
  }

  return { emergentThreads, timestamp: now };
}

// ─── Main Fetch ──────────────────────────────────────────

const DEFAULT_STATE: NetworkWeatherState = {
  warmth: 0.5,
  energy: 0.3,
  conviction: 0.4,
  dominantHue: "slate",
  secondaryHue: "sage",
  source: "fallback",
  timestamp: Date.now(),
  emergence: null,
};

export async function fetchNetworkWeather(): Promise<NetworkWeatherState> {
  try {
    const [sentimentResp, trendingResp] = await Promise.all([
      fetchPan("/api/sentiment/latest"),
      fetchPan("/api/trending/topics?limit=10&hours=6"),
    ]);

    const sentiment: PanSentiment | null = sentimentResp?.data || sentimentResp;
    const trending: PanTrendingTopic[] = trendingResp?.data?.topics || [];

    if (!sentiment && trending.length === 0) {
      return { ...DEFAULT_STATE, timestamp: Date.now() };
    }

    const rawSentiment = sentiment?.overall_sentiment ?? 0;
    const warmth = Math.max(0, Math.min(1, (rawSentiment + 1) / 2));

    const volumeRatio = sentiment?.volume_ratio ?? 1;
    const avgCountRatio = trending.length > 0
      ? trending.reduce((s, t) => s + t.metrics.count_ratio, 0) / trending.length
      : 1;
    const energy = Math.max(0, Math.min(1, (Math.log2(volumeRatio * avgCountRatio) + 1) / 4));

    const variance = sentiment?.sentiment_variance ?? 0.5;
    const conviction = Math.max(0, Math.min(1, 1 - variance));

    const dominantHue = classifyHue(sentiment?.dominant_category, rawSentiment, variance);

    let secondaryHue: WeatherHue;
    if (trending.length >= 2) {
      const ratio = trending[1].metrics.count_ratio;
      if (ratio > 3) secondaryHue = "rust";
      else if (ratio > 1.5) secondaryHue = "ochre";
      else secondaryHue = "sage";
      if (secondaryHue === dominantHue) {
        secondaryHue = dominantHue === "sage" ? "indigo" : "sage";
      }
    } else {
      secondaryHue = dominantHue === "sage" ? "indigo" : "sage";
    }

    const emergence = trending.length > 0 ? detectEmergence(trending) : null;

    return {
      warmth, energy, conviction,
      dominantHue, secondaryHue,
      source: "pan",
      timestamp: Date.now(),
      emergence,
    };
  } catch {
    return { ...DEFAULT_STATE, timestamp: Date.now() };
  }
}
