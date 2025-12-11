import type { BskyAgent } from "@atproto/api";
import { getApiBaseUrl } from "../config/amplify";
import { getApiAuthHeaders } from "../utils/api-auth";
import { createLogger } from "../utils/logger";
import {
  ALT_TEXT_RETRY_OPTIONS,
  API_RETRY_OPTIONS,
  blobUrlToDataUrl,
  fetchWithRetry,
} from "../utils/retry";

const logger = createLogger("AnthropicService");

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

// Tone descriptions for future use
// const TONE_DESCRIPTIONS: Record<ToneOption, string> = {
//   professional: "formal, clear, and business-appropriate language",
//   casual: "relaxed, conversational, and friendly language",
//   humorous:
//     "witty, playful, and entertaining language while maintaining the core message",
//   informative: "educational, fact-focused, and explanatory language",
//   inspirational: "motivating, uplifting, and encouraging language",
// };

export async function adjustTone(
  text: string,
  tone: ToneOption,
): Promise<ToneAdjustmentResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/adjust-tone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ text, tone }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error adjusting tone:", error);
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Tone adjustment failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Tone adjustment failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Tone adjustment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

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

export async function optimizeThread(
  text: string,
  maxCharsPerPost: number = 300,
): Promise<ThreadOptimizationResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/optimize-thread`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ text, maxCharsPerPost }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error optimizing thread:", error);
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Thread optimization failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Thread optimization failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Thread optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export interface HashtagSuggestion {
  tag: string;
  relevance: number;
  isTrending: boolean;
}

export interface HashtagResult {
  hashtags: HashtagSuggestion[];
  category: string;
}

export async function suggestHashtags(
  text: string,
  existingTags?: string[],
): Promise<HashtagResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/suggest-hashtags`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ text, existingTags }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error suggesting hashtags:", error);
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Hashtag suggestions failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Hashtag suggestions failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Hashtag suggestions failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export interface WritingFeedback {
  assessment: {
    summary: string;
    hasIssues: boolean;
  };
  correctedVersion: {
    text: string;
    changes: string[]; // List of corrections made
  };
  enhancedVersion: {
    text: string;
    improvements: string[]; // List of enhancements made
  };
}

export async function getWritingFeedback(
  text: string,
): Promise<WritingFeedback> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/writing-feedback`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error getting writing feedback:", error);
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Writing feedback failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Writing feedback failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Writing feedback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export async function generateAltText(imageUrl: string): Promise<string> {
  try {
    // Convert blob URLs to data URLs since the backend needs base64 data
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith("blob:")) {
      logger.log("Converting blob URL to data URL for alt text generation");
      try {
        // Use retry-enabled blob URL conversion
        processedImageUrl = await blobUrlToDataUrl(imageUrl);
        logger.log("Blob URL converted to data URL successfully");
      } catch (conversionError) {
        logger.error(
          "Failed to convert blob URL to data URL:",
          conversionError,
        );
        throw new Error("Failed to process image for alt text generation");
      }
    }

    // Always use the backend API for all image types
    // This keeps the API key secure on the server
    logger.log("Generating alt text via backend API");

    // In production, use Amplify Function (via API Gateway)
    // In development, proxy through Vite dev server to local Express server
    const apiBaseUrl = getApiBaseUrl();
    const endpoint = `${apiBaseUrl}/api/generate-alt-text`;
    const payload = {
      imageUrl: processedImageUrl,
    };

    logger.log("Generating alt text via backend:", { endpoint });

    const response = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify(payload),
      },
      ALT_TEXT_RETRY_OPTIONS,
    );

    logger.log("Alt text response status:", response.status);

    const data = await response.json();
    logger.log("Alt text response:", data);

    const altText = data.altText?.trim() || "";
    // Bluesky supports up to 1000 chars, but we soft-cap at 500 for reasonableness
    // Don't hard truncate - let Claude generate appropriate length
    return altText;
  } catch (error) {
    logger.error("Error generating alt text:", error);

    // Provide more specific error messages based on error type
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("timeout") ||
        error.message.includes("TIMEOUT_ERROR"))
    ) {
      // Timeout error after all retries
      throw new Error(
        "Alt text generation timed out. The service took too long to respond. Please try again with a smaller image.",
      );
    } else if (error instanceof TypeError && error.message.includes("fetch")) {
      // Network error - likely backend is down or SSL issue
      throw new Error(
        "Alt text generation service is temporarily unavailable. Please deploy the backend server to api.shadowsky.io",
      );
    } else if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Alt text generation failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Alt text generation failed: Rate limit exceeded");
    } else if (
      error instanceof Error &&
      error.message.includes("Server API key not configured")
    ) {
      throw new Error("Alt text generation failed: Server configuration error");
    } else if (
      error instanceof Error &&
      error.message.includes("Failed to fetch")
    ) {
      throw new Error(
        "Backend API server is not responding. Please check that the server is deployed and running.",
      );
    } else {
      throw new Error(
        `Alt text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export interface StyleMatchedWritingFeedback extends WritingFeedback {
  styleAnalysis: {
    userStyleSummary: string;
    matchesStyle: boolean;
    styleNotes: string[];
  };
}

async function analyzeWritingStyle(
  currentText: string,
  historicalPosts: string[],
): Promise<{
  userStyleSummary: string;
  matchesStyle: boolean;
  styleNotes: string[];
}> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/style-analysis`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ currentText, historicalPosts }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error analyzing writing style:", error);
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Style analysis failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Style analysis failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Style analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export async function getStyleMatchedWritingFeedback(
  text: string,
  agent: BskyAgent,
): Promise<StyleMatchedWritingFeedback> {
  try {
    // Get basic writing feedback
    const basicFeedback = await getWritingFeedback(text);

    // Fetch user's recent posts for style analysis
    const session = agent.session;
    if (!session?.did) {
      // If no session, return basic feedback without style analysis
      return {
        ...basicFeedback,
        styleAnalysis: {
          userStyleSummary: "Sign in to enable style analysis",
          matchesStyle: true,
          styleNotes: [],
        },
      };
    }

    try {
      // Fetch user's recent posts (up to 30 posts)
      const authorFeed = await agent.getAuthorFeed({
        actor: session.did,
        limit: 30,
        filter: "posts_no_replies", // Only get original posts, not replies
      });

      // Extract text from posts
      const historicalPosts = authorFeed.data.feed
        .map((item) => {
          const post = item.post;
          if (
            post.record &&
            typeof post.record === "object" &&
            "text" in post.record
          ) {
            return post.record.text as string;
          }
          return null;
        })
        .filter((text): text is string => text !== null && text.length > 0);

      // If we have at least 5 posts, perform style analysis
      if (historicalPosts.length >= 5) {
        const styleAnalysis = await analyzeWritingStyle(text, historicalPosts);

        return {
          ...basicFeedback,
          styleAnalysis,
        };
      } else {
        // Not enough posts for meaningful analysis
        return {
          ...basicFeedback,
          styleAnalysis: {
            userStyleSummary:
              "Not enough posts for style analysis (need at least 5 posts)",
            matchesStyle: true,
            styleNotes: [],
          },
        };
      }
    } catch (styleError) {
      logger.error("Error fetching posts for style analysis:", styleError);
      // Return basic feedback with error message
      return {
        ...basicFeedback,
        styleAnalysis: {
          userStyleSummary: "Unable to analyze style - could not fetch posts",
          matchesStyle: true,
          styleNotes: [],
        },
      };
    }
  } catch (error) {
    logger.error("Error getting style-matched writing feedback:", error);
    throw error;
  }
}

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
  suggestions?: string[]; // Deprecated: kept for backwards compatibility
  observations?: string[]; // New: neutral observations without assuming growth goals
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

export async function analyzePosts(
  posts: PostAnalysisPost[],
  analysisType: "haiku" | "sonnet" = "sonnet",
): Promise<PostAnalysisResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/analyze-posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ posts, analysisType }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error analyzing posts:", error);

    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Post analysis failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Post analysis failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Post analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

// Link Metadata Types
export interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/fetch-link-metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error fetching link metadata:", error);

    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Link metadata fetch failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Link metadata fetch failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Link metadata fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

// Thread Summary Types
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

// Thread summary formats:
// - haiku: Poetic 3-line summary (legacy)
// - tldr: 1 sentence TL;DR
// - keypoints: Bullet point list
// - extended: Multi-paragraph with highlights (legacy)
// Progressive complexity formats:
// - brief: 1 sentence (simple threads, 3-9 replies)
// - moderate: 2-3 sentences (moderate threads, 10-29 replies)
// - detailed: Paragraph with key points (complex threads, 30-74 replies)
// - comprehensive: Multi-paragraph with sub-thread analysis (viral, 75+ replies)
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

export async function generateThreadSummary(
  posts: ThreadSummaryPost[],
  format: ThreadSummaryFormat = "haiku",
  options?: { forceRefresh?: boolean },
): Promise<ThreadSummaryResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    let endpoint = `${apiBaseUrl}/api/thread-summary`;
    if (options?.forceRefresh) {
      endpoint += "?forceRefresh=true";
    }

    const response = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ posts, format }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error generating thread summary:", error);

    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Thread summary failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Thread summary failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Thread summary failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
