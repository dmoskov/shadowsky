import Anthropic from "@anthropic-ai/sdk";
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
      model: "claude-3-haiku-20240307",
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
      model: "claude-3-haiku-20240307",
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
        // Fallback to simple splitting
        const segments = text.match(/.{1,300}(?:\s|$)/g) || [text];
        return {
          segments: segments.map((s, i) => ({
            text: s.trim(),
            number: i + 1,
            isStandalone: false,
          })),
          summary: "Thread about " + text.slice(0, 50) + "...",
          suggestedFormat: "simple",
          totalPosts: segments.length,
        };
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

export interface SmartReply {
  text: string;
  tone: ToneOption;
  confidence: number;
}

export interface SmartReplyResult {
  suggestions: SmartReply[];
  context: string;
}

export async function generateSmartReplies(
  parentPost: string,
  userHandle?: string,
  conversationContext?: string[],
): Promise<SmartReplyResult> {
  try {
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const contextString = conversationContext?.join("\n---\n") || "";

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Generate 3-4 smart reply suggestions for this social media post. Each reply should have a different tone and be under 280 characters.

Parent post: "${parentPost}"
${userHandle ? `Posted by: @${userHandle}` : ""}
${contextString ? `Conversation context:\n${contextString}` : ""}

Generate replies with these tones:
1. Friendly/supportive
2. Thoughtful/analytical
3. Humorous (if appropriate)
4. Question/engaging

Respond with a JSON object containing:
- suggestions: array of {text: string, tone: string, confidence: number (0-1)}
- context: brief description of the conversation topic

Make replies natural, relevant, and appropriate to the context. Ensure the response is valid JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      try {
        const result = JSON.parse(content.text);
        return result;
      } catch (parseError) {
        logger.error("Failed to parse smart reply response:", parseError);
        // Fallback responses
        return {
          suggestions: [
            {
              text: "Thanks for sharing this!",
              tone: "casual",
              confidence: 0.5,
            },
            {
              text: "Interesting perspective. What made you think of this?",
              tone: "informative",
              confidence: 0.5,
            },
          ],
          context: "General conversation",
        };
      }
    }

    throw new Error("Unexpected response format");
  } catch (error) {
    logger.error("Error generating smart replies:", error);
    analytics.trackError(error as Error, "smart_replies");

    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Smart replies failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Smart replies failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Smart replies failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Smart replies failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      model: "claude-3-haiku-20240307",
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
        // Fallback
        return {
          hashtags: [
            {
              tag: "thoughts",
              relevance: 0.5,
              isTrending: false,
            },
          ],
          category: "General",
        };
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
  clarity: {
    score: number; // 0-100
    issues: string[];
    suggestions: string[];
  };
  tone: {
    detected: string;
    appropriateness: number; // 0-100
    suggestions: string[];
  };
  engagement: {
    score: number; // 0-100
    strengths: string[];
    improvements: string[];
  };
  overall: {
    summary: string;
    readyToPost: boolean;
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
      model: "claude-3-haiku-20240307",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Analyze this social media post and provide constructive feedback.

Post: "${text}"

Provide feedback in a JSON format with these sections:
1. clarity: score (0-100), issues array, suggestions array
2. tone: detected tone, appropriateness score (0-100), suggestions array
3. engagement: score (0-100), strengths array, improvements array
4. overall: brief summary, readyToPost boolean

Focus on:
- Is the message clear and easy to understand?
- Is the tone appropriate for social media?
- Will it engage readers?
- Are there any potential issues (typos, unclear phrasing, etc)?

Be constructive and helpful. Ensure the response is valid JSON.`,
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
        // Fallback
        return {
          clarity: { score: 75, issues: [], suggestions: [] },
          tone: { detected: "neutral", appropriateness: 80, suggestions: [] },
          engagement: { score: 70, strengths: [], improvements: [] },
          overall: { summary: "Your post looks good!", readyToPost: true },
        };
      }
    }

    throw new Error("Unexpected response format");
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
    // Check if API key is configured
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    // Determine the server URL based on environment
    const serverUrl = import.meta.env.PROD
      ? import.meta.env.VITE_PROXY_SERVER_URL || "https://api.shadowsky.io"
      : ""; // Empty string means use same origin (proxied through Vite)

    const endpoint = `${serverUrl}/api/generate-alt-text`;
    const payload = {
      imageUrl,
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    };

    logger.log("Generating alt text:", { endpoint, imageUrl });

    // Send the image URL to the backend for processing
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
      const errorMessage = errorData?.error || `Server returned ${response.status}`;
      logger.error("Alt text generation failed:", errorMessage, errorData);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logger.log("Alt text response:", data);
    
    const altText = data.altText?.trim() || "";
    
    // Ensure the alt text is not too long
    return altText.length > 125 ? altText.substring(0, 122) + "..." : altText;
  } catch (error) {
    logger.error("Error generating alt text:", error);

    // Track error for analytics
    analytics.trackError(error as Error, "alt_text_generation");

    // Provide more specific error messages
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error("Alt text generation failed: API key not configured");
    } else if (error instanceof Error && error.message.includes("401")) {
      throw new Error("Alt text generation failed: Invalid API key");
    } else if (error instanceof Error && error.message.includes("429")) {
      throw new Error("Alt text generation failed: Rate limit exceeded");
    } else {
      throw new Error(
        `Alt text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
