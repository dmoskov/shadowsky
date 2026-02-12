/**
 * AI Service for Mobile
 * Provides thread summary and other AI features for React Native
 */

import { Platform } from "react-native";

export interface ThreadSummaryPost {
  text: string;
  author: string;
  authorHandle: string;
  likes: number;
  replies: number;
  reposts?: number;
  uri: string;
  parentUri?: string;
  depth?: number;
}

export type ThreadSummaryFormat =
  | "haiku"
  | "tldr"
  | "keypoints"
  | "extended"
  | "brief"
  | "moderate"
  | "detailed"
  | "comprehensive";

export interface SubThreadHighlight {
  uri: string;
  authorHandle: string;
  snippet: string;
  engagement: number;
}

export interface ThreadSummaryMetadata {
  postCount: number;
  authors: string[];
  generatedAt: string;
  cached?: boolean;
  totalEngagement?: number;
  highlightedSubThreads?: SubThreadHighlight[];
}

export interface ThreadSummaryResult {
  summary: string;
  format: ThreadSummaryFormat;
  metadata: ThreadSummaryMetadata;
}

/**
 * Get the API base URL for mobile
 * For development, this should point to your local API server or staging
 * For production, this should point to your production API
 */
function getApiBaseUrl(): string {
  // In development mode, you might use a different URL
  // Update this based on your setup (e.g., local IP for testing on device)
  if (__DEV__) {
    // For iOS simulator, localhost works
    // For Android emulator, use 10.0.2.2
    // For physical device, use your computer's IP address
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3002"; // Android emulator
    }
    return "http://localhost:3002"; // iOS simulator
  }

  // Production API URL - get from environment or config
  // This should match your deployed Amplify API Gateway URL
  return process.env.EXPO_PUBLIC_API_URL || "";
}

/**
 * Get API auth headers
 * Mobile version that works without Vite/import.meta
 */
function getApiAuthHeaders(): Record<string, string> {
  // The API key should be stored securely
  // In production, consider using secure storage for the key
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (apiKey) {
    return {
      "X-API-Key": apiKey,
    };
  }

  return {};
}

/**
 * Generate thread summary using AI
 */
export async function generateThreadSummary(
  posts: ThreadSummaryPost[],
  format: ThreadSummaryFormat = "brief",
): Promise<ThreadSummaryResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const endpoint = `${apiBaseUrl}/api/thread-summary`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ posts, format }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Thread summary failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Thread summary failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Thread summary failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Network errors in dev are expected when the local API server isn't running
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Thread summary unavailable: API server not reachable");
    }
    console.error("Error generating thread summary:", error);
    throw error;
  }
}
