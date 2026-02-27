/**
 * AI Service for Mobile
 * Provides thread summary and other AI features for React Native
 */

import { Platform } from "react-native";
import * as FileSystem from 'expo-file-system';

import { createLogger } from '../utils/logger';
import { getAtProtoClient } from './atproto/client';

const logger = createLogger('AiService');
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
  analyzedPostCount?: number;
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
 * API version prefix for all endpoints.
 * When updating the API version, change this constant.
 * The server also supports unversioned /api/ paths for backward compatibility.
 */
const API_VERSION = "v1";

/**
 * Amplify API Gateway production URL.
 * Must match the endpoint in amplify_outputs.json → custom.API.shadowsky-api.endpoint.
 * EAS builds can override via EXPO_PUBLIC_API_URL if needed.
 */
const AMPLIFY_API_URL = "https://api.shadowsky.io";

/**
 * Get the API base URL for mobile.
 * In production, uses the Amplify API Gateway URL (same backend the web app uses).
 * In development, points to the local API server for testing.
 */
function getApiBaseUrl(): string {
  if (__DEV__) {
    // For iOS simulator, localhost works
    // For Android emulator, use 10.0.2.2
    // For physical device, use your computer's IP address
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3002";
    }
    return "http://localhost:3002";
  }

  // Production: use Amplify API Gateway URL, allow env override
  return process.env.EXPO_PUBLIC_API_URL || AMPLIFY_API_URL;
}

/**
 * Get the versioned API path prefix.
 * Returns the base URL with the version prefix for API calls.
 * Example: "http://localhost:3002/api/v1" or "https://api.example.com/api/v1"
 */
function getVersionedApiUrl(): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/${API_VERSION}`;
}

/**
 * Get API auth headers
 * Sends the user's Bluesky DID for server-side authentication,
 * matching the web app's auth pattern (X-User-DID / X-Bluesky-DID).
 */
function getApiAuthHeaders(): Record<string, string> {
  try {
    const client = getAtProtoClient();
    const session = client.getSession();
    if (session?.did) {
      return {
        "X-User-DID": session.did,
        "X-Bluesky-DID": session.did,
      };
    }
  } catch {
    // Client not initialized yet (user not logged in)
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
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/thread-summary`;

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
    logger.error('Error generating thread summary:', error);
    throw error;
  }
}

/**
 * Convert local file URI to base64 data URL
 */
async function fileUriToDataUrl(uri: string): Promise<string> {
  try {
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Detect MIME type from file extension
    let mimeType = 'image/jpeg'; // Default to JPEG
    const extension = uri.toLowerCase().split('.').pop();

    if (extension === 'png') {
      mimeType = 'image/png';
    } else if (extension === 'gif') {
      mimeType = 'image/gif';
    } else if (extension === 'webp') {
      mimeType = 'image/webp';
    } else if (extension === 'heic' || extension === 'heif') {
      mimeType = 'image/heic';
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    logger.error('Error converting file URI to data URL:', error);
    throw new Error('Failed to read image file');
  }
}

/**
 * Generate alt text for an image using AI
 * @param imageUri - Local file URI (e.g., from expo-image-picker)
 * @returns Generated alt text description
 */
export async function generateAltText(imageUri: string): Promise<string> {
  try {
    // Convert local file URI to base64 data URL
    logger.log('Converting image URI to data URL:', imageUri);
    const dataUrl = await fileUriToDataUrl(imageUri);

    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/generate-alt-text`;

    logger.log('Generating alt text via backend:', { endpoint });

    // Create abort controller for 8s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ imageUrl: dataUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          throw new Error("Alt text generation failed: Invalid API key");
        } else if (status === 429) {
          throw new Error("Alt text generation failed: Rate limit exceeded");
        } else if (status === 503) {
          throw new Error("Alt text generation service is temporarily unavailable");
        } else {
          throw new Error(
            `Alt text generation failed: ${response.statusText || "Unknown error"}`,
          );
        }
      }

      const data = await response.json();
      const altText = data.altText?.trim() || "";

      logger.log('Alt text generated successfully');
      return altText;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (fetchError.name === 'AbortError') {
        throw new Error(
          "Alt text generation timed out. The service took too long to respond. Please try again with a smaller image.",
        );
      }

      throw fetchError;
    }
  } catch (error) {
    // Network errors in dev are expected when the local API server isn't running
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Alt text generation unavailable: API server not reachable");
    }

    // Re-throw if it's already a formatted error message
    if (error instanceof Error && error.message.includes("Alt text generation")) {
      throw error;
    }

    logger.error('Error generating alt text:', error);
    throw new Error(
      `Alt text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Tone adjustment types
export type ToneOption =
  | "professional"
  | "casual"
  | "humorous"
  | "informative"
  | "inspirational";

export interface ToneAdjustmentResult {
  adjustedText: string;
  originalText: string;
  tone: ToneOption;
}

/**
 * Adjust the tone of text using AI
 */
export async function adjustTone(
  text: string,
  tone: ToneOption,
): Promise<ToneAdjustmentResult> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/adjust-tone`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ text, tone }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Tone adjustment failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Tone adjustment failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Tone adjustment failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Tone adjustment unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Tone adjustment")) {
      throw error;
    }

    logger.error('Error adjusting tone:', error);
    throw new Error(
      `Tone adjustment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Post Analysis Types (AI Analytics)
export interface PostAnalysisPost {
  text: string;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
}

export interface ContentTheme {
  theme: string;
  description: string;
  frequency: "primary" | "regular" | "occasional";
  examples: string[];
}

export interface WritingStyleAnalysis {
  tone: string;
  characteristics: string[];
  voiceDescription: string;
}

export interface EngagementPatterns {
  topPerformers: string[];
  contentStrengths: string[];
  suggestions?: string[];
  observations?: string[];
}

export interface OptimalTimeRecommendation {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, -1 = any day
  avgEngagement: number;
  confidence: "high" | "medium" | "low";
}

export interface OptimalPostingTimes {
  recommendations: OptimalTimeRecommendation[];
  hourlyEngagement: number[];
  weekdayEngagement: number[];
  lastCalculated: string;
}

export interface PostAnalysisResult {
  contentThemes: ContentTheme[];
  writingStyle: WritingStyleAnalysis;
  engagementPatterns: EngagementPatterns;
  summary: string;
  optimalPostingTimes?: OptimalPostingTimes;
}

/**
 * Analyze user posts using AI to identify themes, writing style, and engagement patterns
 */
export async function analyzePosts(
  posts: PostAnalysisPost[],
  analysisType: "haiku" | "sonnet" = "sonnet",
): Promise<PostAnalysisResult> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/analyze-posts`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ posts, analysisType }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Post analysis failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Post analysis failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Post analysis failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Post analysis unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Post analysis")) {
      throw error;
    }

    logger.error('Error analyzing posts:', error);
    throw new Error(
      `Post analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}

/**
 * Fetch link metadata (title, description, image) for a URL
 */
/**
 * Generate alt text for an image using its URL (for existing posts with CDN URLs)
 * @param imageUrl - HTTP URL of the image (e.g., CDN URL from Bluesky)
 * @returns Generated alt text description
 */
export async function generateAltTextFromUrl(imageUrl: string): Promise<string> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/generate-alt-text`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ imageUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          throw new Error("Alt text generation failed: Invalid API key");
        } else if (status === 429) {
          throw new Error("Alt text generation failed: Rate limit exceeded");
        } else if (status === 503) {
          throw new Error("Alt text generation service is temporarily unavailable");
        } else {
          throw new Error(
            `Alt text generation failed: ${response.statusText || "Unknown error"}`,
          );
        }
      }

      const data = await response.json();
      return data.altText?.trim() || "";
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error("Alt text generation timed out. Please try again.");
      }
      throw fetchError;
    }
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Alt text generation unavailable: API server not reachable");
    }
    if (error instanceof Error && error.message.includes("Alt text generation")) {
      throw error;
    }
    logger.error('Error generating alt text from URL:', error);
    throw new Error(
      `Alt text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const apiUrl = getVersionedApiUrl();
  const endpoint = `${apiUrl}/fetch-link-metadata`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Link metadata fetch failed: ${response.statusText || "Unknown error"}`);
  }

  const data = await response.json();
  return {
    url: data.url || url,
    title: data.title || "",
    description: data.description || "",
    imageUrl: data.imageUrl,
  };
}

// Hashtag suggestion types
export interface HashtagSuggestion {
  tag: string;
  relevance: number;
  isTrending: boolean;
}

export interface HashtagResult {
  hashtags: HashtagSuggestion[];
  category: string;
}

/**
 * Suggest relevant hashtags for post text
 */
export async function suggestHashtags(
  text: string,
  existingTags?: string[],
): Promise<HashtagResult> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/suggest-hashtags`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ text, existingTags }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Hashtag suggestions failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Hashtag suggestions failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Hashtag suggestions failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Hashtag suggestions unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Hashtag suggestions")) {
      throw error;
    }

    logger.error('Error suggesting hashtags:', error);
    throw new Error(
      `Hashtag suggestions failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Writing feedback types
export interface WritingFeedback {
  assessment: {
    summary: string;
    hasIssues: boolean;
  };
  correctedVersion: {
    text: string;
    changes: string[];
  };
  enhancedVersion: {
    text: string;
    improvements: string[];
  };
}

/**
 * Get writing feedback for post text
 */
export async function getWritingFeedback(
  text: string,
): Promise<WritingFeedback> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/writing-feedback`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Writing feedback failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Writing feedback failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Writing feedback failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Writing feedback unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Writing feedback")) {
      throw error;
    }

    logger.error('Error getting writing feedback:', error);
    throw new Error(
      `Writing feedback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Style analysis types
export interface StyleAnalysisResult {
  userStyleSummary: string;
  matchesStyle: boolean;
  styleNotes: string[];
}

/**
 * Analyze writing style by comparing current text against historical posts
 */
export async function analyzeWritingStyle(
  currentText: string,
  historicalPosts: string[],
): Promise<StyleAnalysisResult> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/style-analysis`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ currentText, historicalPosts }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Style analysis failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Style analysis failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Style analysis failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Style analysis unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Style analysis")) {
      throw error;
    }

    logger.error('Error analyzing writing style:', error);
    throw new Error(
      `Style analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Thread optimization types
export interface ThreadSegment {
  text: string;
  number: number;
  isStandalone: boolean;
}

export interface ThreadOptimizationResult {
  segments: ThreadSegment[];
  summary: string;
  suggestedFormat: "simple" | "brackets" | "thread" | "dots";
  totalPosts: number;
}

/**
 * Optimize text for thread posting
 */
export async function optimizeThread(
  text: string,
  maxCharsPerPost: number = 300,
): Promise<ThreadOptimizationResult> {
  try {
    const apiUrl = getVersionedApiUrl();
    const endpoint = `${apiUrl}/optimize-thread`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiAuthHeaders(),
      },
      body: JSON.stringify({ text, maxCharsPerPost }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        throw new Error("Thread optimization failed: Invalid API key");
      } else if (status === 429) {
        throw new Error("Thread optimization failed: Rate limit exceeded");
      } else {
        throw new Error(
          `Thread optimization failed: ${response.statusText || "Unknown error"}`,
        );
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "Network request failed"
    ) {
      throw new Error("Thread optimization unavailable: API server not reachable");
    }

    if (error instanceof Error && error.message.includes("Thread optimization")) {
      throw error;
    }

    logger.error('Error optimizing thread:', error);
    throw new Error(
      `Thread optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
