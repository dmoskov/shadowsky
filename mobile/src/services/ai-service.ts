/**
 * AI Service for Mobile
 * Provides thread summary and other AI features for React Native
 */

import { Platform } from "react-native";
import * as FileSystem from 'expo-file-system';

import { createLogger } from '../utils/logger';

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
 * Get the API base URL for mobile
 * For development, this should point to your local API server or staging
 * For production, this should point to your production API
 */
function getApiBaseUrl(): string {
  // In development mode, you might use a different URL
  // Update this based on your setup (e.g., local IP for testing on device)
  let baseUrl: string;
  if (__DEV__) {
    // For iOS simulator, localhost works
    // For Android emulator, use 10.0.2.2
    // For physical device, use your computer's IP address
    if (Platform.OS === "android") {
      baseUrl = "http://10.0.2.2:3002"; // Android emulator
    } else {
      baseUrl = "http://localhost:3002"; // iOS simulator
    }
  } else {
    // Production API URL - get from environment or config
    // This should match your deployed Amplify API Gateway URL
    baseUrl = process.env.EXPO_PUBLIC_API_URL || "";
  }

  return baseUrl;
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
