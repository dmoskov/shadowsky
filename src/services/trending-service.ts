/**
 * Service for fetching trending topics and trends from Bluesky's public API
 * Uses the unspecced namespace endpoints (may change without notice)
 */

const TRENDING_API_BASE = "https://public.api.bsky.app/xrpc";

export interface TrendingTopic {
  topic: string;
  link: string;
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
  link: string;
  startedAt?: string;
  postCount?: number;
  status?: "hot" | string;
  category?: string;
  actors?: TrendActor[];
}

export interface TrendsResponse {
  trends: Trend[];
}

/**
 * Fetch trending topics with optional personalization
 * @param limit Number of topics to fetch (1-25)
 * @param viewer Optional DID for personalized results
 */
export async function getTrendingTopics(
  limit: number = 10,
  viewer?: string,
): Promise<TrendingTopicsResponse> {
  const params = new URLSearchParams();
  params.set("limit", Math.min(Math.max(1, limit), 25).toString());
  if (viewer) {
    params.set("viewer", viewer);
  }

  const response = await fetch(
    `${TRENDING_API_BASE}/app.bsky.unspecced.getTrendingTopics?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch trending topics: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch trends with more detailed information including actors and post counts
 * @param limit Number of trends to fetch (1-25)
 */
export async function getTrends(limit: number = 10): Promise<TrendsResponse> {
  const params = new URLSearchParams();
  params.set("limit", Math.min(Math.max(1, limit), 25).toString());

  const response = await fetch(
    `${TRENDING_API_BASE}/app.bsky.unspecced.getTrends?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch trends: ${response.status}`);
  }

  return response.json();
}

/**
 * Cache TTL for trending data (5 minutes)
 */
export const TRENDING_CACHE_TTL = 5 * 60 * 1000;
