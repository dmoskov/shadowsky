/**
 * Network Weather Service
 *
 * Fetches narrative data from Pan's firehose API and transforms it
 * into the textile model (threads, crossings, luminance, saturation).
 * Supports personal filtering by a set of followed DIDs — filtering
 * happens client-side using community membership data from Pan, which
 * preserves privacy (no social graph sent to server).
 *
 * Ref: docs/vision/network-weather.md § Data Architecture
 */

import { debug } from "@bsky/shared";
import { dedupeNarratives } from "./narrative-dedupe";
import { fetchFromPan as fetchPanJson } from "./pan-api";
import type {
  GapAnalysis,
  GapThread,
  NarrativeThread,
  TextileState,
  ThreadCharacter,
  ThreadCrossing,
} from "../types/network-weather";

// ─── Pan API ─────────────────────────────────────────────

/** Raw narrative cluster from Pan /api/narratives */
interface PanNarrative {
  id: string;
  label: string;
  keywords: string[];
  post_count: number;
  author_count: number;
  unique_author_dids?: string[];
  sentiment_mean: number;
  sentiment_variance: number;
  age_hours: number;
  velocity_ratio: number;
  author_diversity_ratio: number;
  category?: string;
  sample_post_uris?: string[];
}

/** Raw crossing from Pan /api/narratives/crossings */
interface PanCrossing {
  narrative_a: string;
  narrative_b: string;
  shared_author_count: number;
  engagement_score: number;
}

/** Raw response from Pan /api/narratives */
interface PanNarrativesResponse {
  data: {
    narratives: PanNarrative[];
    crossings?: PanCrossing[];
    network_energy: number;
    network_conviction: number;
    weather_summary?: string;
    detection_time: string;
  };
}

// ─── Fetch Helper ────────────────────────────────────────

async function fetchFromPan(path: string): Promise<unknown> {
  const data = await fetchPanJson(path);
  if (data === null) throw new Error("Pan API unavailable");
  return data;
}

// ─── Character Classification ────────────────────────────

/**
 * Map a narrative's signals to a thread character for palette selection.
 * Uses category hint from Pan when available, otherwise infers from
 * sentiment and keyword patterns.
 */
function classifyCharacter(narrative: PanNarrative): ThreadCharacter {
  const cat = narrative.category?.toLowerCase();
  if (cat) {
    if (cat.includes("tech") || cat.includes("code") || cat.includes("science"))
      return "analytical";
    if (
      cat.includes("art") ||
      cat.includes("music") ||
      cat.includes("creative")
    )
      return "creative";
    if (cat.includes("politic") || cat.includes("governance"))
      return "structural";
    if (cat.includes("learn") || cat.includes("education"))
      return "educational";
    if (cat.includes("personal") || cat.includes("support")) return "personal";
    if (cat.includes("meta") || cat.includes("platform")) return "meta";
  }

  // Infer from sentiment signals
  if (narrative.sentiment_variance > 0.6) return "contested";
  if (narrative.sentiment_mean > 0.5 && narrative.author_diversity_ratio > 0.6)
    return "communal";
  if (narrative.sentiment_mean < -0.2) return "contested";

  return "communal"; // default
}

/**
 * Classify thread direction: enduring conversations (warp/vertical)
 * vs emergent conversations (weft/horizontal).
 * Threshold: 24 hours separates enduring from emergent.
 */
function classifyDirection(ageHours: number): "warp" | "weft" {
  return ageHours >= 24 ? "warp" : "weft";
}

// ─── Transform Pan → Textile ─────────────────────────────

function transformNarrative(
  n: PanNarrative,
  maxAuthors: number,
): NarrativeThread {
  return {
    id: n.id,
    label: n.label,
    character: classifyCharacter(n),
    direction: classifyDirection(n.age_hours),
    width: maxAuthors > 0 ? Math.min(n.author_count / maxAuthors, 1) : 0.1,
    opacity: Math.min(Math.max(1 - n.author_diversity_ratio, 0.2), 1),
    texture: Math.min(n.sentiment_variance, 1),
    authorCount: n.author_count,
    postCount: n.post_count,
    ageHours: n.age_hours,
    velocityRatio: n.velocity_ratio,
    authorDids: n.unique_author_dids,
    samplePostUris: n.sample_post_uris,
  };
}

/** Luminance used when Pan's network_energy isn't a usable measurement. */
const NEUTRAL_LUMINANCE = 0.4;

/**
 * Map Pan's network_energy onto a 0-1 luminance.
 *
 * network_energy is a *ratio* against baseline activity, not a 0-1 fraction —
 * it currently reports the same value as the sentiment endpoint's volume_ratio,
 * and is routinely above 1. An earlier guard treated `>= 1` as a saturated
 * sensor and substituted neutral, which was right while the value was pinned at
 * exactly 1.0 but now throws away a real reading.
 *
 * log2 so that doubling activity is one even step, centred so baseline (1.0)
 * sits mid-range, then clamped to stay legible behind text at both ends.
 */
function luminanceFromEnergy(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return NEUTRAL_LUMINANCE;
  const centred = 0.5 + Math.log2(ratio) / 4;
  return Math.min(0.9, Math.max(0.15, centred));
}

function transformToTextile(
  response: PanNarrativesResponse,
  source: "pan" = "pan",
): TextileState {
  // Pan emits several rows per conversation; collapse them so the textile
  // shows distinct threads rather than one band per duplicate.
  const narratives = dedupeNarratives(
    response.data.narratives,
    (n) => n.label,
    (n) => n.author_count,
  );
  const maxAuthors = Math.max(...narratives.map((n) => n.author_count), 1);

  const threads = narratives.map((n) => transformNarrative(n, maxAuthors));

  const crossings: ThreadCrossing[] = (response.data.crossings ?? []).map(
    (c) => ({
      warpId: c.narrative_a,
      weftId: c.narrative_b,
      brightness: Math.min(c.engagement_score, 1),
      sharedAuthorCount: c.shared_author_count,
    }),
  );

  return {
    threads,
    crossings,
    luminance: luminanceFromEnergy(response.data.network_energy),
    saturation: Math.min(response.data.network_conviction, 1),
    weatherReport:
      response.data.weather_summary ?? generateWeatherReport(threads),
    timestamp: Date.now(),
    source,
  };
}

// ─── Weather Report Generation ───────────────────────────

function generateWeatherReport(threads: NarrativeThread[]): string {
  if (threads.length === 0) return "The network is quiet.";

  const warp = threads.filter((t) => t.direction === "warp");
  const weft = threads.filter((t) => t.direction === "weft");
  const widest = [...threads].sort((a, b) => b.width - a.width)[0];

  if (weft.length === 0 && warp.length > 0) {
    return `Steady currents today — ${warp.length} enduring conversations, nothing new breaking through.`;
  }

  if (weft.length > warp.length) {
    return `A burst of ${weft.length} new conversations cutting across ${warp.length} ongoing threads. Something is shifting.`;
  }

  if (widest && widest.width > 0.7) {
    return `The network is converging around "${widest.label}" — a wide thread drawing many voices.`;
  }

  return `${threads.length} threads weaving across the network, a mix of old currents and new signals.`;
}

// ─── Public API: Fetch Global Textile ────────────────────

export async function fetchGlobalTextile(): Promise<TextileState> {
  try {
    // `/api/narratives` is the endpoint that carries `narratives`,
    // `network_energy`, and `network_conviction`. This previously requested
    // `/api/narratives/crossings`, whose payload has none of those — so
    // `response.data.narratives` was undefined, the transform threw, and every
    // caller silently got the empty fallback textile instead of the ~50 live
    // threads. Crossings are optional enrichment, not the source of threads.
    const response = (await fetchFromPan(
      "/api/narratives",
    )) as PanNarrativesResponse;

    // Guard rather than relying on the transform throwing on a bad shape.
    if (!response?.data?.narratives?.length) {
      debug.log("Pan returned no narratives; using empty textile");
      return generateSyntheticTextile();
    }
    return transformToTextile(response);
  } catch {
    debug.log("Pan narratives unavailable, generating synthetic textile");
    return generateSyntheticTextile();
  }
}

// ─── Personal Filtering ──────────────────────────────────

/**
 * Filter a global textile to only include threads where the user's
 * follows are participating. This is done client-side to preserve
 * privacy — we never send the social graph to Pan.
 *
 * For each thread, we check how many of its author DIDs overlap with
 * the followed set. Threads with zero overlap are removed; threads
 * with partial overlap have their width scaled proportionally.
 */
export function filterTextileByFollows(
  global: TextileState,
  followedDids: Set<string>,
): TextileState {
  if (followedDids.size === 0) return { ...global, threads: [], crossings: [] };

  const personalThreads: NarrativeThread[] = [];
  const personalThreadIds = new Set<string>();

  for (const thread of global.threads) {
    const dids = thread.authorDids ?? [];

    if (dids.length === 0) {
      // No DID data — include with reduced width as we can't filter
      personalThreads.push({ ...thread, width: thread.width * 0.3 });
      personalThreadIds.add(thread.id);
      continue;
    }

    const overlapCount = dids.filter((d) => followedDids.has(d)).length;
    const overlapRatio = overlapCount / dids.length;

    if (overlapRatio > 0) {
      // Scale width by follow overlap — your network's share of this thread
      personalThreads.push({
        ...thread,
        width: thread.width * overlapRatio,
        authorCount: overlapCount,
      });
      personalThreadIds.add(thread.id);
    }
  }

  // Re-normalize widths so the widest personal thread fills the space
  const maxWidth = Math.max(...personalThreads.map((t) => t.width), 0.01);
  const normalizedThreads = personalThreads.map((t) => ({
    ...t,
    width: t.width / maxWidth,
  }));

  // Filter crossings to only include threads that survived
  const personalCrossings = global.crossings.filter(
    (c) => personalThreadIds.has(c.warpId) && personalThreadIds.has(c.weftId),
  );

  return {
    threads: normalizedThreads,
    crossings: personalCrossings,
    luminance:
      global.luminance *
      (personalThreads.length / Math.max(global.threads.length, 1)),
    saturation: global.saturation,
    weatherReport: generatePersonalWeatherReport(
      normalizedThreads,
      global.threads,
    ),
    timestamp: Date.now(),
    source: global.source,
  };
}

function generatePersonalWeatherReport(
  personalThreads: NarrativeThread[],
  globalThreads: NarrativeThread[],
): string {
  const missing = globalThreads.length - personalThreads.length;

  if (personalThreads.length === 0) {
    return "Your network is quiet — none of the global conversations have reached your follows yet.";
  }

  if (missing === 0) {
    return "Your network mirrors the global conversation — you're connected to everything happening.";
  }

  const widest = [...personalThreads].sort((a, b) => b.width - a.width)[0];

  if (missing > globalThreads.length / 2) {
    return `Your network focuses on ${personalThreads.length} threads while ${missing} global conversations pass by unnoticed.`;
  }

  return `Your follows are woven into ${personalThreads.length} of ${globalThreads.length} threads${widest ? `, strongest around "${widest.label}"` : ""}.`;
}

// ─── Gap Analysis ────────────────────────────────────────

/**
 * Compute the differential between global and personal textiles.
 * Identifies what you're missing, what your network uniquely cares about,
 * and where attention is amplified or diminished relative to the world.
 */
export function computeGapAnalysis(
  global: TextileState,
  personal: TextileState,
): GapAnalysis {
  const personalById = new Map(personal.threads.map((t) => [t.id, t]));
  const globalById = new Map(global.threads.map((t) => [t.id, t]));

  const missing: GapThread[] = [];
  const unique: GapThread[] = [];
  const amplified: GapThread[] = [];
  const diminished: GapThread[] = [];

  // Check global threads against personal
  for (const gt of global.threads) {
    const pt = personalById.get(gt.id);

    if (!pt) {
      // Present globally, absent personally → "what am I missing?"
      missing.push({
        thread: gt,
        gapType: "missing",
        personalToGlobalRatio: 0,
      });
    } else {
      const ratio = gt.width > 0 ? pt.width / gt.width : 0;

      if (ratio > 1.5) {
        amplified.push({
          thread: gt,
          gapType: "amplified",
          personalToGlobalRatio: ratio,
        });
      } else if (ratio < 0.3) {
        diminished.push({
          thread: gt,
          gapType: "diminished",
          personalToGlobalRatio: ratio,
        });
      }
    }
  }

  // Check personal threads not in global (shouldn't normally happen,
  // but possible with niche follow-only clusters)
  for (const pt of personal.threads) {
    if (!globalById.has(pt.id)) {
      unique.push({
        thread: pt,
        gapType: "unique",
        personalToGlobalRatio: Infinity,
      });
    }
  }

  // Overlap score: how similar are the two views?
  const globalIds = new Set(global.threads.map((t) => t.id));
  const personalIds = new Set(personal.threads.map((t) => t.id));
  const intersection = [...globalIds].filter((id) =>
    personalIds.has(id),
  ).length;
  const union = new Set([...globalIds, ...personalIds]).size;
  const overlapScore = union > 0 ? intersection / union : 0;

  return { missing, unique, amplified, diminished, overlapScore };
}

// ─── Synthetic Textile (Fallback) ────────────────────────

/**
 * Generate a synthetic textile from Bluesky trending data when Pan
 * narratives are unavailable. Maps trends to threads with approximate
 * character classification.
 */
export function generateSyntheticTextile(): TextileState {
  // Return minimal empty textile — actual trending data integration
  // happens in the hook via useTrends()
  return {
    threads: [],
    crossings: [],
    luminance: 0.3,
    saturation: 0.3,
    weatherReport: "Waiting for network signals...",
    timestamp: Date.now(),
    source: "synthetic",
  };
}

/**
 * Build a textile from Bluesky trend data (fallback when Pan narratives
 * endpoint is not yet available).
 */
export function textileFromTrends(
  trends: Array<{
    topic: string;
    displayName?: string;
    status?: string;
    postCount?: number;
    authorCount?: number;
    trendScore?: number;
    actors?: Array<{ did: string }>;
  }>,
): TextileState {
  if (trends.length === 0) return generateSyntheticTextile();

  const maxAuthors = Math.max(
    ...trends.map((t) => t.authorCount ?? t.actors?.length ?? 1),
    1,
  );

  const threads: NarrativeThread[] = trends.map((t, i) => {
    const authorCount = t.authorCount ?? t.actors?.length ?? 1;
    const isHot = t.status === "hot" || t.status === "surging";

    return {
      id: `trend-${i}`,
      label: t.displayName ?? t.topic,
      character: "communal" as ThreadCharacter,
      direction: (isHot ? "weft" : "warp") as "warp" | "weft",
      width: maxAuthors > 0 ? Math.min(authorCount / maxAuthors, 1) : 0.1,
      opacity: 0.6,
      texture: 0.2,
      authorCount,
      postCount: t.postCount ?? 0,
      ageHours: isHot ? 2 : 48,
      velocityRatio: t.trendScore ?? 1,
      authorDids: t.actors?.map((a) => a.did),
    };
  });

  const totalPosts = threads.reduce((sum, t) => sum + t.postCount, 0);
  const luminance = Math.min(totalPosts / 10000, 1);

  return {
    threads,
    crossings: [],
    luminance: Math.max(luminance, 0.2),
    saturation: 0.5,
    weatherReport: generateWeatherReport(threads),
    timestamp: Date.now(),
    source: "bluesky",
  };
}

// ─── Cache TTL ───────────────────────────────────────────

export const WEATHER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
