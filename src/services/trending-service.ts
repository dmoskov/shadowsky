/**
 * Trending Topics Service (Web)
 *
 * Fetches trending topics from Pan's firehose-powered trending API.
 * Falls back to Bluesky's native getTrendingTopics if Pan is unreachable.
 *
 * Pan endpoints (same AWS account, no API key needed):
 *   - api.shadowsky.io/api/trending/topics (primary)
 *   - api.asphodel.is/api/trending/topics (fallback)
 */

import { fetchFromPan as fetchPanJson } from "./pan-api";

const BLUESKY_API_BASE = "https://public.api.bsky.app/xrpc";

export interface TrendingTopic {
  topic: string;
  link?: string;
}

export interface TrendingTopicsResponse {
  topics: TrendingTopic[];
  suggested: TrendingTopic[];
}

export interface TrendActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
}

export interface Trend {
  topic: string;
  displayName: string;
  link?: string;
  startedAt?: string;
  postCount?: number;
  authorCount?: number;
  status?: string;
  category?: string;
  actors?: TrendActor[];
  trendScore?: number;
}

export interface TrendsResponse {
  trends: Trend[];
  source: "pan" | "bluesky";
}

export const TRENDING_CACHE_TTL = 5 * 60 * 1000;

// ─── Pan API Types ────────────────────────────────────────

interface PanTrendingTopic {
  token: string;
  rank: number;
  trend_score: number;
  metrics: {
    hourly_count: number;
    hourly_unique_authors: number;
    hourly_engagement: number;
    count_ratio: number;
    engagement_ratio: number;
    author_diversity_ratio: number;
  };
  sample_posts?: string[];
}

interface PanTrendingResponse {
  data: {
    topics: PanTrendingTopic[];
    detection_time: string;
    count: number;
  };
}

// ─── Pan Fetch ────────────────────────────────────────────

async function fetchFromPan(
  path: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const data = await fetchPanJson(path, params);
  if (data === null) throw new Error("Pan API unavailable");
  return data;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Fetch trends from Pan, fall back to Bluesky.
 */
export async function getTrends(limit: number = 20): Promise<TrendsResponse> {
  // Try Pan first
  try {
    const panData: PanTrendingResponse = await fetchFromPan(
      "/api/trending/topics",
      { limit, hours: 6 },
    );

    const trends: Trend[] = panData.data.topics.map((t) => ({
      topic: t.token,
      displayName: t.token,
      postCount: t.metrics.hourly_count,
      authorCount: t.metrics.hourly_unique_authors,
      trendScore: t.trend_score,
    }));

    return { trends, source: "pan" };
  } catch {
    // Fall through to Bluesky
  }

  // Fallback: Bluesky
  try {
    const params = new URLSearchParams();
    params.set("limit", Math.min(Math.max(1, limit), 25).toString());

    const response = await fetch(
      `${BLUESKY_API_BASE}/app.bsky.unspecced.getTrends?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (response.ok) {
      const data = await response.json();
      return {
        trends: (data.trends || []).map((t: any) => ({
          topic: t.topic,
          displayName: t.displayName || t.topic,
          link: t.link,
          startedAt: t.startedAt,
          postCount: t.postCount,
          status: t.status,
          category: t.category,
          actors: t.actors,
        })),
        source: "bluesky",
      };
    }
  } catch {
    // Fall through
  }

  return { trends: [], source: "bluesky" };
}

/**
 * Fetch trending topics in simple format (backward compat).
 */
export async function getTrendingTopics(
  limit: number = 10,
  viewer?: string,
): Promise<TrendingTopicsResponse> {
  // Try Pan
  try {
    const panData: PanTrendingResponse = await fetchFromPan(
      "/api/trending/topics",
      { limit, hours: 6 },
    );

    return {
      topics: panData.data.topics.map((t) => ({ topic: t.token })),
      suggested: [],
    };
  } catch {
    // Fallback
  }

  const params = new URLSearchParams();
  params.set("limit", Math.min(Math.max(1, limit), 25).toString());
  if (viewer) params.set("viewer", viewer);

  const response = await fetch(
    `${BLUESKY_API_BASE}/app.bsky.unspecced.getTrendingTopics?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    return { topics: [], suggested: [] };
  }

  return response.json();
}
