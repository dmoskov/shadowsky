/**
 * Trending Topics Service
 *
 * Fetches trending topics from Pan's firehose-powered trending API.
 * Falls back to Bluesky's native getTrendingTopics if Pan is unreachable.
 *
 * Pan endpoints (same AWS account, no API key needed):
 *   - api.shadowsky.io/api/trending/topics (primary)
 *   - api.asphodel.is/api/trending/topics (fallback)
 */

import { getAtProtoClient } from "./atproto/client";
import { rateLimited, ATProtoEndpointType } from "./rate-limiter";
import { fetchWithTimeout } from "../utils/with-timeout";
import { createLogger } from "../utils/logger";

const logger = createLogger("TrendingService");

// Pan API base URLs — try primary first, fall back to alias
const PAN_API_URLS = [
  "https://api.shadowsky.io",
  "https://api.asphodel.is",
];

export const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (matches Pan's cache)

// ─── Pan API Types ────────────────────────────────────────

interface PanTrendingMetrics {
  hourly_count: number;
  hourly_unique_authors: number;
  hourly_engagement: number;
  count_ratio: number; // vs 24h baseline
  engagement_ratio: number;
  author_diversity_ratio: number;
}

interface PanTrendingTopic {
  token: string;
  rank: number;
  trend_score: number;
  metrics: PanTrendingMetrics;
  sample_posts?: string[];
}

interface PanTrendingResponse {
  data: {
    topics: PanTrendingTopic[];
    detection_time: string;
    count: number;
  };
}

// ─── Public Types (consumed by components) ────────────────

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
}

export type TrendStatus = "surging" | "hot" | "rising" | "stable";

export interface Trend {
  topic: string;
  displayName?: string;
  link?: string;
  startedAt?: string;
  status?: TrendStatus | string;
  postCount?: number;
  authorCount?: number;
  category?: string;
  actors?: TrendActor[];
  trendScore?: number;
  samplePostUris?: string[];
}

export interface TrendsResponse {
  trends: Trend[];
  source: "pan" | "bluesky";
}

// ─── Velocity Classification ──────────────────────────────

function classifyVelocity(countRatio: number): TrendStatus {
  if (countRatio > 5.0) return "surging";
  if (countRatio > 2.0) return "hot";
  if (countRatio > 1.2) return "rising";
  return "stable";
}



// ─── Pan API Fetch ────────────────────────────────────────

async function fetchFromPan(
  path: string,
  params: Record<string, string | number> = {}
): Promise<any> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    query.set(k, String(v));
  }
  const qs = query.toString() ? `?${query.toString()}` : "";

  // Try each Pan URL
  for (const baseUrl of PAN_API_URLS) {
    try {
      const url = `${baseUrl}${path}${qs}`;
      const response = await fetchWithTimeout(url, {
        headers: { Accept: "application/json" },
      }, 5000);

      if (!response.ok) {
        logger.warn(`Pan API ${baseUrl} returned ${response.status}`);
        continue;
      }

      return await response.json();
    } catch (error) {
      logger.warn(`Pan API ${baseUrl} failed:`, error);
      continue;
    }
  }

  throw new Error("All Pan API endpoints unreachable");
}

// ─── Public API ───────────────────────────────────────────

/**
 * Fetch trending topics from Pan's firehose-powered API.
 * Falls back to Bluesky's native trending API.
 */
export async function getTrends(
  limit: number = 20,
  hours: number = 6
): Promise<TrendsResponse> {
  // Try Pan first
  try {
    const panData: PanTrendingResponse = await fetchFromPan(
      "/api/trending/topics",
      { limit, hours }
    );

    const trends: Trend[] = panData.data.topics.map((t) => {
      const status = classifyVelocity(t.metrics.count_ratio);
      return {
        topic: t.token,
        displayName: t.token,
        status,
        postCount: t.metrics.hourly_count,
        authorCount: t.metrics.hourly_unique_authors,
        trendScore: t.trend_score,
        samplePostUris: t.sample_posts,
      };
    });

    return { trends, source: "pan" };
  } catch (error) {
    logger.warn("Pan trending unavailable, falling back to Bluesky:", error);
  }

  // Fallback: Bluesky's native API
  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      try {
        const response = await agent.app.bsky.unspecced.getTrends({ limit });
        const trends: Trend[] = (response.data.trends || []).map((t) => ({
          topic: t.topic,
          displayName: t.displayName,
          link: t.link,
          startedAt: t.startedAt,
          status: t.status as TrendStatus,
          postCount: t.postCount,
          category: t.category,
          actors: t.actors?.map((a) => ({
            did: a.did,
            handle: a.handle,
            displayName: a.displayName,
            avatar: a.avatar,
          })),
        }));
        return { trends, source: "bluesky" as const };
      } catch (innerError) {
        logger.warn("Bluesky trends also failed, trying topics:", innerError);

        // Final fallback: simple topics
        const topicsResp = await agent.app.bsky.unspecced.getTrendingTopics({ limit });
        const trends: Trend[] = [
          ...(topicsResp.data.topics || []).map((t) => ({
            topic: t.topic,
            displayName: t.topic,
            status: "stable" as TrendStatus,
          })),
          ...(topicsResp.data.suggested || []).map((t) => ({
            topic: t.topic,
            displayName: t.topic,
            status: "rising" as TrendStatus,
          })),
        ];
        return { trends, source: "bluesky" as const };
      }
    },
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch trending topics in the simpler format (for backward compat).
 */
export async function getTrendingTopics(
  limit: number = 10,
  viewer?: string
): Promise<TrendingTopicsResponse> {
  // Try Pan first, map to simple format
  try {
    const panData: PanTrendingResponse = await fetchFromPan(
      "/api/trending/topics",
      { limit, hours: 6 }
    );

    return {
      topics: panData.data.topics.map((t) => ({
        topic: t.token,
      })),
      suggested: [],
    };
  } catch {
    // Fallback to Bluesky
  }

  return rateLimited(
    async () => {
      const client = getAtProtoClient();
      const agent = client.getAgent();

      try {
        const response = await agent.app.bsky.unspecced.getTrendingTopics({
          limit,
          viewer,
        });

        return {
          topics: response.data.topics || [],
          suggested: response.data.suggested || [],
        };
      } catch (error) {
        logger.warn("Failed to fetch trending topics:", error);
        return { topics: [], suggested: [] };
      }
    },
    ATProtoEndpointType.FEED
  );
}

// ─── Utility exports ──────────────────────────────────────

export { classifyVelocity };
