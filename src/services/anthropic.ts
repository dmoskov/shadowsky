import Anthropic from "@anthropic-ai/sdk";
import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { ProfileService } from "../shared/services";
import { createLogger } from "../utils/logger";
import { analytics } from "./analytics";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || "",
  dangerouslyAllowBrowser: true,
});

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

const TONE_DESCRIPTIONS: Record<ToneOption, string> = {
  professional: "formal, clear, and business-appropriate language",
  casual: "relaxed, conversational, and friendly language",
  humorous:
    "witty, playful, and entertaining language while maintaining the core message",
  informative: "educational, fact-focused, and explanatory language",
  inspirational: "motivating, uplifting, and encouraging language",
};

export async function adjustTone(
  text: string,
  tone: ToneOption,
): Promise<ToneAdjustmentResult> {
  try {
    // Check if API key is configured
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Rewrite the following text to have a ${tone} tone. Use ${TONE_DESCRIPTIONS[tone]}. Maintain the original meaning and key information, but adjust the style and word choice. Keep it concise and suitable for a social media post (under 300 characters per segment if it needs to be split).

Original text: "${text}"

Provide only the rewritten text without any explanation or prefixes.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      return {
        adjustedText: content.text.trim(),
        originalText: text,
        tone,
      };
    }

    throw new Error("Unexpected response format");
  } catch (error) {
    logger.error("Error adjusting tone:", error);

    // Track error for analytics
    analytics.trackError(error as Error, "tone_adjustment");

    // Provide more specific error messages
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Tone adjustment failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
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
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyze this text and split it into an optimal thread for a social media platform. Each post should be under ${maxCharsPerPost} characters, self-contained, and engaging.

Rules:
1. Each segment must make sense on its own
2. Preserve the narrative flow
3. End segments with complete thoughts
4. Create natural breaks at topic transitions
5. Keep important context together
6. Suggest the best numbering format based on content type

Text to split: "${text}"

Respond with a JSON object containing:
- segments: array of {text: string, number: number, isStandalone: boolean}
- summary: brief description of the thread topic
- suggestedFormat: "simple" (1/n), "brackets" ([1/n]), "thread" (🧵), or "dots" (1.)
- totalPosts: total number of posts

Ensure the response is valid JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const result = JSON.parse(content.text);
        return result;
      } catch (parseError) {
        logger.error(
          "Failed to parse thread optimization response:",
          parseError,
        );
        logger.error("Raw response:", content.text);
        throw new Error(
          "AI service returned invalid response format. Please try again.",
        );
      }
    }

    throw new Error("Unexpected response format");
  } catch (error) {
    logger.error("Error optimizing thread:", error);
    analytics.trackError(error as Error, "thread_optimization");

    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Thread optimization failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
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
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Suggest 3-5 relevant hashtags for this social media post. Consider the content, tone, and potential audience.

Post content: "${text}"
${existingTags?.length ? `Already using: ${existingTags.join(", ")}` : ""}

Rules:
1. Hashtags should be relevant and specific to the content
2. Mix popular and niche tags for better reach
3. Avoid overly generic tags
4. Consider current trends and topics
5. Don't repeat existing tags

Respond with a JSON object containing:
- hashtags: array of {tag: string (without #), relevance: number (0-1), isTrending: boolean}
- category: main topic category of the post

Ensure the response is valid JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const result = JSON.parse(content.text);
        return result;
      } catch (parseError) {
        logger.error("Failed to parse hashtag response:", parseError);
        logger.error("Raw response:", content.text);
        throw new Error(
          "AI service returned invalid response format. Please try again.",
        );
      }
    }

    throw new Error("Unexpected response format");
  } catch (error) {
    logger.error("Error suggesting hashtags:", error);
    analytics.trackError(error as Error, "hashtag_suggestions");

    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Hashtag suggestions failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
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
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Analyze this social media post and provide helpful feedback with improved versions.

Post: "${text}"

Provide a JSON response with:
1. assessment: 
   - summary: brief quality assessment (1-2 sentences)
   - hasIssues: boolean indicating if there are typos or issues
2. correctedVersion:
   - text: the post with ONLY typos, grammar, and spelling fixed (minimal changes)
   - changes: array of strings describing corrections (e.g. ["Fixed spelling of 'spelling'", "Corrected grammar"]) - empty array if none needed
3. enhancedVersion:
   - text: a slightly improved version (just a little better - keep the original voice and style)
   - improvements: array of strings describing what was enhanced

Keep corrections minimal and enhancements subtle. Preserve the author's voice.

Example JSON structure:
{
  "assessment": { "summary": "...", "hasIssues": true },
  "correctedVersion": { "text": "...", "changes": ["Fixed X", "Corrected Y"] },
  "enhancedVersion": { "text": "...", "improvements": ["Made more concise", "Enhanced clarity"] }
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Use proper JSON arrays with strings only (no arrow notation like "a" -> "b")
2. Ensure all arrays and objects are properly closed with ] and }
3. Double-check that your JSON is valid before responding
4. Do not include any text before or after the JSON object
5. Start directly with { and end with }`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const result = JSON.parse(content.text);
        return result;
      } catch (parseError) {
        logger.error("Failed to parse writing feedback response:", parseError);
        logger.error("Raw response:", content.text);
        throw new Error(
          "AI service returned invalid response format. Please try again.",
        );
      }
    }

    throw new Error("Unexpected response format from AI service");
  } catch (error) {
    logger.error("Error getting writing feedback:", error);
    analytics.trackError(error as Error, "writing_feedback");

    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Writing feedback failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
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
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        processedImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        logger.log("Blob URL converted to data URL successfully");
      } catch (conversionError) {
        logger.error(
          "Failed to convert blob URL to data URL:",
          conversionError,
        );
        throw new Error("Failed to process image for alt text generation");
      }
    }

    // Always use the backend proxy for all image types
    // This keeps the API key secure on the server
    logger.log("Generating alt text via backend proxy");

    const serverUrl = import.meta.env.PROD
      ? import.meta.env.VITE_PROXY_SERVER_URL || "https://api.shadowsky.io"
      : ""; // Empty string means use same origin (proxied through Vite)

    const endpoint = `${serverUrl}/api/generate-alt-text`;
    const payload = {
      imageUrl: processedImageUrl,
    };

    logger.log("Generating alt text via backend:", { endpoint });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    logger.log("Alt text response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.error || `Server returned ${response.status}`;
      logger.error("Alt text generation failed:", errorMessage, errorData);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logger.log("Alt text response:", data);

    const altText = data.altText?.trim() || "";
    return altText.length > 125 ? altText.substring(0, 122) + "..." : altText;
  } catch (error) {
    logger.error("Error generating alt text:", error);

    // Track error for analytics
    analytics.trackError(error as Error, "alt_text_generation");

    // Provide more specific error messages
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Alt text generation failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Alt text generation failed: Rate limit exceeded");
    } else if (
      error instanceof Error &&
      error.message.includes("Server API key not configured")
    ) {
      throw new Error(
        "Alt text generation failed: Server configuration error",
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

export async function getStyleMatchedWritingFeedback(
  text: string,
  agent: BskyAgent,
): Promise<StyleMatchedWritingFeedback> {
  try {
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    // Get current user's handle
    const session = agent.session;
    if (!session?.handle) {
      throw new Error("User not authenticated");
    }

    logger.log("Fetching recent posts for style matching...");

    // Fetch user's recent posts
    const profileService = new ProfileService(agent);
    const authorFeed = await profileService.getAuthorFeed(
      session.handle,
      40, // Get last 40 posts
      undefined,
      "posts_no_replies", // Only get original posts, not replies
    );

    // Extract text content from posts
    const userPosts: string[] = [];
    authorFeed.feed.forEach((item: AppBskyFeedDefs.FeedViewPost) => {
      if (
        item.post.record &&
        typeof item.post.record === "object" &&
        "text" in item.post.record
      ) {
        const postText = (item.post.record as { text: string }).text;
        if (postText && postText.trim()) {
          userPosts.push(postText);
        }
      }
    });

    logger.log(`Fetched ${userPosts.length} posts for style analysis`);

    // Create a sample of recent posts for context (limit to avoid token limits)
    const recentPostsSample = userPosts.slice(0, 20).join("\n---\n");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyze this social media post and provide helpful feedback with improved versions, taking into account the user's writing style.

User's recent posts (for style reference):
${recentPostsSample}

New post to analyze: "${text}"

Provide a JSON response with:
1. assessment: 
   - summary: brief quality assessment (1-2 sentences)
   - hasIssues: boolean indicating if there are typos or issues
2. correctedVersion:
   - text: the post with ONLY typos, grammar, and spelling fixed (minimal changes)
   - changes: array of strings describing corrections (e.g. ["Fixed spelling of 'spelling'", "Corrected grammar"]) - empty array if none needed
3. enhancedVersion:
   - text: a slightly improved version that maintains their writing style
   - improvements: array of strings describing what was enhanced
4. styleAnalysis:
   - userStyleSummary: brief description of their typical writing style
   - matchesStyle: boolean indicating if this post matches their usual style
   - styleNotes: array of strings with observations about style consistency

Keep corrections minimal and enhancements subtle. The enhanced version should feel natural to their voice.

Example JSON structure:
{
  "assessment": { "summary": "...", "hasIssues": true },
  "correctedVersion": { "text": "...", "changes": ["Fixed X", "Corrected Y"] },
  "enhancedVersion": { "text": "...", "improvements": ["Made more concise"] },
  "styleAnalysis": { "userStyleSummary": "...", "matchesStyle": true, "styleNotes": ["Note 1", "Note 2"] }
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Use proper JSON arrays with strings only (no arrow notation like "a" -> "b")
2. Ensure all arrays and objects are properly closed with ] and }
3. Double-check that your JSON is valid before responding
4. Do not include any text before or after the JSON object
5. Start directly with { and end with }`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        // Log the raw response for debugging
        logger.log("Raw API response:", content.text);
        
        // Try to extract JSON from the response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return result;
        } else {
          throw new Error("No JSON object found in response");
        }
      } catch (parseError) {
        logger.error(
          "Failed to parse style-matched feedback response:",
          parseError,
        );
        logger.error("Raw response:", content.text);
        throw new Error(
          "AI service returned invalid response format. Please try again.",
        );
      }
    }

    throw new Error("Unexpected response format from AI service");
  } catch (error) {
    logger.error("Error getting style-matched writing feedback:", error);
    analytics.trackError(error as Error, "style_matched_writing_feedback");

    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes("User not authenticated")) {
        throw new Error("Please sign in to use writing feedback");
      } else if (error.message.includes("401")) {
        throw new Error(
          "AI service authentication failed. Please check API key configuration.",
        );
      } else if (error.message.includes("429")) {
        throw new Error(
          "AI service rate limit exceeded. Please try again later.",
        );
      } else if (error.message.includes("API key not configured")) {
        throw new Error("AI service not configured. Please contact support.");
      }
    }

    // Re-throw the error so it's shown in the UI
    throw error;
  }
}
