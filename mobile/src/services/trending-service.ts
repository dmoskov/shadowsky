/**
 * Service for fetching trending topics and trends from Bluesky
 */

import { getAtProtoClient } from "./atproto/client";
import { withRetry } from "../utils/with-retry";
import { rateLimited, ATProtoEndpointType } from "./rate-limiter";

export interface TrendingTopic {
  topic: string;
  link?: string;
}

export interface TrendingTopicsResponse {
  topics: TrendingTopic[];
  suggested: TrendingTopic[];
}

export interface Trend {
  topic: string;
  displayName?: string;
  status?: "hot" | "rising" | "stable";
  postCount?: number;
  category?: string;
}

export interface TrendsResponse {
  trends: Trend[];
}

export const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch trending topics (simpler format)
 */
export async function getTrendingTopics(
  limit: number = 10,
  viewer?: string
): Promise<TrendingTopicsResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
          // If trending topics API is not available, return empty arrays
          console.warn("Failed to fetch trending topics:", error);
          return { topics: [], suggested: [] };
        }
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch detailed trends (if available in the future)
 * For now, this wraps getTrendingTopics and transforms the data
 */
export async function getTrends(limit: number = 10): Promise<TrendsResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const topicsData = await getTrendingTopics(limit);

        // Transform topics into trends format
        const trends: Trend[] = [
          ...topicsData.topics.map((t) => ({
            topic: t.topic,
            displayName: t.topic,
            status: "stable" as const,
          })),
          ...topicsData.suggested.map((t) => ({
            topic: t.topic,
            displayName: t.topic,
            status: "rising" as const,
          })),
        ];

        return { trends };
      }),
    ATProtoEndpointType.FEED
  );
}
