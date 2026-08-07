/**
 * Network Weather Service (Web)
 *
 * Fetches sentiment and energy signals from Pan to drive the ambient
 * textile background. Shared logic with mobile, adapted for web.
 *
 * See: docs/vision/network-weather.md
 */

import { dedupeNarratives } from "./narrative-dedupe";
import { fetchFromPan } from "./pan-api";

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
  /**
   * False when `energy` is a neutral placeholder rather than a measurement
   * (saturated formula, or Pan omitted volume_ratio). Consumers should avoid
   * asserting anything about energy when this is false.
   */
  energyReliable: boolean;
  conviction: number;
  dominantHue: WeatherHue;
  secondaryHue: WeatherHue;
  source: "pan" | "fallback";
  timestamp: number;
  emergence: EmergenceState | null;
  narratives: NarrativeState | null;
}

export interface EmergentThread {
  token: string;
  ageMinutes: number;
  countRatio: number;
  isEmergent: boolean;
  pulseIntensity: number;
  /** Posts Pan classified into this topic, when provided */
  samplePostUris?: string[];
}

export interface EmergenceState {
  emergentThreads: EmergentThread[];
  timestamp: number;
}

export interface Narrative {
  id: string;
  name: string;
  authorCount: number;
  authorWeight: number;
  threadType: "warp" | "weft";
  /**
   * Posts Pan classified into this narrative. Labels are generated cluster
   * summaries, so searching Bluesky for one returns nothing — these URIs are
   * the only way to open a narrative's actual content.
   */
  samplePostUris?: string[];
}

export interface NarrativeCrossing {
  narrativeA: string;
  narrativeB: string;
  sharedAuthors: number;
  overlapRatio: number;
}

export interface NarrativeState {
  narratives: Narrative[];
  crossings: NarrativeCrossing[];
  timestamp: number;
  source: "pan" | "empty";
}

// ─── Color Palette (natural dye colors) ───────────────────

export const WEATHER_COLORS: Record<
  WeatherHue,
  { dark: string; light: string }
> = {
  ochre: { dark: "#C4973B", light: "#E8D5A3" },
  rust: { dark: "#A0522D", light: "#D4967A" },
  indigo: { dark: "#3B4F8A", light: "#8B9FCC" },
  sage: { dark: "#6B8F6B", light: "#A8C5A8" },
  slate: { dark: "#5A6B7A", light: "#94A3B3" },
  sienna: { dark: "#8B5E3C", light: "#C4A07A" },
  charcoal: { dark: "#4A4A4A", light: "#8A8A8A" },
  ivory: { dark: "#B8B0A0", light: "#E8E2D8" },
};

/** Resolve a weather hue for the active theme. */
export function weatherColor(hue: WeatherHue, isDark: boolean): string {
  return isDark ? WEATHER_COLORS[hue].dark : WEATHER_COLORS[hue].light;
}

/** Weather hues are authored as hex; ambient washes need them with alpha. */
export function weatherColorWithAlpha(
  hue: WeatherHue,
  isDark: boolean,
  alpha: number,
): string {
  const hex = weatherColor(hue, isDark).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  /** AT URIs of posts Pan classified into this topic (may be empty) */
  sample_posts?: string[];
}

// ─── Fetch Helpers ────────────────────────────────────────

/**
 * Fetch a Pan path and unwrap its `{ success, data, meta }` envelope.
 *
 * Every caller gets the payload, never the envelope. Callers used to unwrap it
 * themselves and disagreed about how: sentiment read `.data`, trending read
 * `.data.topics`, and narrative crossings read `.crossings` off the envelope —
 * which is always undefined, so narratives silently resolved to "empty" for
 * every user, forever. One unwrapping rule here removes that whole class of
 * bug. Falls back to the raw body for any endpoint that isn't enveloped.
 */
async function fetchPan(path: string): Promise<any> {
  const body: any = await fetchFromPan(path);
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
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
  if (cat.includes("tech") || cat.includes("code") || cat.includes("science"))
    return "indigo";
  if (cat.includes("art") || cat.includes("music") || cat.includes("creative"))
    return "rust";
  if (cat.includes("politic") || cat.includes("govern")) return "slate";
  if (cat.includes("personal") || cat.includes("story")) return "sienna";
  if (cat.includes("learn") || cat.includes("education")) return "sage";
  if (cat.includes("meta") || cat.includes("platform")) return "ivory";
  if (cat.includes("celebrat") || cat.includes("communit")) return "ochre";
  return "sage";
}

// ─── Energy ───────────────────────────────────────────────

/** Energy we report when the inputs can't produce a trustworthy value. */
const NEUTRAL_ENERGY = 0.5;

/**
 * Derive network energy, and say whether the result means anything.
 *
 * Pan's `/api/sentiment/latest` does not currently return `volume_ratio`, so
 * energy collapses to `(log2(avgCountRatio) + 1) / 4`, which saturates at an
 * average count ratio of 8 — a level live data sits at routinely. A saturated
 * value is indistinguishable from "busier than we can measure", so rather than
 * reporting a confident 1.0 we report neutral and flag it as unreliable. The
 * ambient layer and the written report both fall back instead of asserting.
 */
function computeEnergy(
  sentiment: PanSentiment | null,
  trending: PanTrendingTopic[],
): { energy: number; energyReliable: boolean } {
  const hasVolume = sentiment?.volume_ratio != null;
  if (trending.length === 0) {
    return { energy: NEUTRAL_ENERGY, energyReliable: false };
  }

  const volumeRatio = sentiment?.volume_ratio ?? 1;
  const avgCountRatio =
    trending.reduce((s, t) => s + t.metrics.count_ratio, 0) / trending.length;
  const raw = (Math.log2(volumeRatio * avgCountRatio) + 1) / 4;

  // Clamped at either end means the formula ran out of range, not that we
  // measured a true extreme.
  const saturated = raw >= 1 || raw <= 0;
  if (saturated || !hasVolume) {
    return { energy: NEUTRAL_ENERGY, energyReliable: false };
  }
  return { energy: raw, energyReliable: true };
}

// ─── Narrative Fetch ──────────────────────────────────

const EMPTY_NARRATIVES: NarrativeState = {
  narratives: [],
  crossings: [],
  timestamp: 0,
  source: "empty",
};

/** Enduring conversations are the warp; newer ones cut across as the weft. */
const WARP_AGE_HOURS = 24;

/**
 * Fetch the live narrative threads behind the ambient textile.
 *
 * This used to derive narratives from `/api/narratives/crossings` — pairwise
 * author overlaps — but that endpoint returns no crossings in practice, so the
 * textile never had threads to draw. `/api/narratives` is the endpoint that
 * actually carries them, with per-narrative author counts and ages, so warp and
 * weft can be classified from age (matching network-weather-service.ts) rather
 * than by arbitrarily splitting a sorted list down the middle.
 *
 * Crossings are left empty: nothing reads them on this path, so there is no
 * reason to spend a second request on them.
 */
async function fetchNarratives(): Promise<NarrativeState> {
  const resp = await fetchPan("/api/narratives");
  const raw: any[] = resp?.narratives ?? [];
  if (raw.length === 0) return { ...EMPTY_NARRATIVES, timestamp: Date.now() };

  // Pan returns heavy near-duplicates (50 rows collapsing to a handful of
  // labels, and those labels often restating one story); one band each would
  // read as a far busier network than exists.
  const deduped = dedupeNarratives(
    raw,
    (n) => String(n.label ?? ""),
    (n) => n.author_count ?? 0,
  );
  if (deduped.length === 0) {
    return { ...EMPTY_NARRATIVES, timestamp: Date.now() };
  }

  const maxAuthors = Math.max(...deduped.map((n) => n.author_count ?? 0), 1);

  const narratives: Narrative[] = deduped
    .map((n) => ({
      id: String(n.id),
      name: String(n.label).trim(),
      authorCount: n.author_count ?? 0,
      authorWeight: (n.author_count ?? 0) / maxAuthors,
      threadType:
        (n.age_hours ?? 0) >= WARP_AGE_HOURS
          ? ("warp" as const)
          : ("weft" as const),
      samplePostUris: Array.isArray(n.sample_post_uris)
        ? n.sample_post_uris.filter(
            (uri: unknown): uri is string =>
              typeof uri === "string" && uri.length > 0,
          )
        : undefined,
    }))
    .sort((a, b) => b.authorWeight - a.authorWeight);

  return {
    narratives,
    crossings: [],
    timestamp: Date.now(),
    source: "pan",
  };
}

// ─── Emergence Detection ─────────────────────────────────

const SNAPSHOT_KEY = "shadowsky_weather_topic_snapshots";
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * When *most* topics look emergent, "emergent" has stopped meaning anything.
 * Above this share we suppress the signal rather than flag the whole board.
 */
const EMERGENCE_MAX_SHARE = 0.5;

type TopicSnapshot = { timestamp: number; countRatio: number };

/**
 * First-seen times for trending topics, persisted across loads.
 *
 * Emergence asks "is this new?", which needs memory of previous visits. This
 * was an in-memory Map, so every page load started empty, every topic looked
 * brand new, and the whole trending board came back flagged as emergent.
 */
function loadSnapshots(): Map<string, TopicSnapshot> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return new Map();
    const cutoff = Date.now() - SNAPSHOT_MAX_AGE_MS;
    const entries = Object.entries(
      JSON.parse(raw) as Record<string, TopicSnapshot>,
    ).filter(([, v]) => v?.timestamp > cutoff);
    return new Map(entries);
  } catch {
    return new Map(); // Corrupt or unavailable storage: start fresh.
  }
}

function saveSnapshots(snapshots: Map<string, TopicSnapshot>): void {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify(Object.fromEntries(snapshots)),
    );
  } catch {
    // Storage full or blocked; emergence degrades to per-session memory.
  }
}

const previousSnapshots = loadSnapshots();

function detectEmergence(topics: PanTrendingTopic[]): EmergenceState {
  const now = Date.now();
  const emergentThreads: EmergentThread[] = [];

  for (const topic of topics) {
    const prev = previousSnapshots.get(topic.token);
    const isNew = !prev || now - prev.timestamp > 2 * 60 * 60 * 1000;
    const isGrowing = topic.metrics.count_ratio > 3;
    // Diversity ratio alone lets near-single-author spam through; require a
    // floor of real distinct voices before calling something emergent.
    const isOrganic =
      topic.metrics.author_diversity_ratio > 1.5 &&
      topic.metrics.hourly_unique_authors >= 5;
    const isEmergent = isNew && isGrowing && isOrganic;

    const ageMinutes = prev ? Math.round((now - prev.timestamp) / 60000) : 0;
    const pulseIntensity = isEmergent
      ? Math.min(
          1,
          (((topic.metrics.count_ratio - 3) / 5) *
            (topic.metrics.author_diversity_ratio - 1)) /
            2,
        )
      : 0;

    if (isEmergent || (isNew && isGrowing)) {
      emergentThreads.push({
        token: topic.token,
        ageMinutes,
        countRatio: topic.metrics.count_ratio,
        isEmergent,
        pulseIntensity,
        samplePostUris: topic.sample_posts?.length
          ? topic.sample_posts
          : undefined,
      });
    }

    previousSnapshots.set(topic.token, {
      timestamp: prev?.timestamp ?? now,
      countRatio: topic.metrics.count_ratio,
    });
  }

  saveSnapshots(previousSnapshots);

  // Degenerate case: if emergence is flagging most of the board it isn't
  // distinguishing anything, so report none rather than lighting everything up.
  const flagged = emergentThreads.filter((t) => t.isEmergent);
  const indiscriminate =
    topics.length > 1 && flagged.length > topics.length * EMERGENCE_MAX_SHARE;

  if (indiscriminate) {
    return {
      emergentThreads: emergentThreads.map((t) => ({
        ...t,
        isEmergent: false,
        pulseIntensity: 0,
      })),
      timestamp: now,
    };
  }

  return { emergentThreads, timestamp: now };
}

// ─── Main Fetch ──────────────────────────────────────────

const DEFAULT_STATE: NetworkWeatherState = {
  warmth: 0.5,
  energy: 0.3,
  energyReliable: false,
  conviction: 0.4,
  dominantHue: "slate",
  secondaryHue: "sage",
  source: "fallback",
  timestamp: Date.now(),
  emergence: null,
  narratives: null,
};

export async function fetchNetworkWeather(): Promise<NetworkWeatherState> {
  try {
    const [sentimentResp, trendingResp, narrativeState] = await Promise.all([
      fetchPan("/api/sentiment/latest"),
      fetchPan("/api/trending/topics?limit=10&hours=6"),
      fetchNarratives(),
    ]);

    // fetchPan already unwrapped the envelope for both of these.
    const sentiment: PanSentiment | null = sentimentResp;
    const trending: PanTrendingTopic[] = trendingResp?.topics || [];

    if (!sentiment && trending.length === 0) {
      return { ...DEFAULT_STATE, timestamp: Date.now() };
    }

    const rawSentiment = sentiment?.overall_sentiment ?? 0;
    const warmth = Math.max(0, Math.min(1, (rawSentiment + 1) / 2));

    const { energy, energyReliable } = computeEnergy(sentiment, trending);

    const variance = sentiment?.sentiment_variance ?? 0.5;
    const conviction = Math.max(0, Math.min(1, 1 - variance));

    const dominantHue = classifyHue(
      sentiment?.dominant_category,
      rawSentiment,
      variance,
    );

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
      warmth,
      energy,
      energyReliable,
      conviction,
      dominantHue,
      secondaryHue,
      source: "pan",
      timestamp: Date.now(),
      emergence,
      narratives: narrativeState.source === "pan" ? narrativeState : null,
    };
  } catch {
    return { ...DEFAULT_STATE, timestamp: Date.now() };
  }
}
