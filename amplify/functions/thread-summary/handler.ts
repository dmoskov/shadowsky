import type { APIGatewayProxyHandler } from "aws-lambda";
import { createApiResponse, createErrorResponse } from "../shared/api-response";

interface ThreadPost {
  text: string;
  author: string;
  likes: number;
  replies: number;
}

type SummaryFormat = "haiku" | "tldr" | "keypoints";

interface AnthropicMessage {
  role: string;
  content: string;
}

interface AnthropicResponse {
  content: Array<{ text: string }>;
}

// In-memory cache with 1-hour TTL
const cache = new Map<
  string,
  { summary: string; format: string; metadata: any; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function generateCacheKey(posts: ThreadPost[], format: string): string {
  const postsHash = JSON.stringify(posts.map((p) => p.text + p.author)).slice(
    0,
    100,
  );
  return `${format}-${postsHash}`;
}

function getCachedSummary(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedSummary(key: string, value: any) {
  cache.set(key, { ...value, timestamp: Date.now() });
  // Limit cache size to 100 entries
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return createErrorResponse(500, "Server configuration error");
    }

    const body = JSON.parse(event.body || "{}");
    const { posts, format = "haiku" } = body;
    const forceRefresh =
      event.queryStringParameters?.forceRefresh === "true";

    // Input validation
    if (!posts || !Array.isArray(posts)) {
      return createErrorResponse(400, "Missing or invalid posts array");
    }

    if (posts.length === 0) {
      return createErrorResponse(400, "Posts array cannot be empty");
    }

    if (posts.length > 500) {
      return createErrorResponse(
        400,
        "Too many posts (maximum 500 per request)",
      );
    }

    const validFormats: SummaryFormat[] = ["haiku", "tldr", "keypoints"];
    if (!validFormats.includes(format)) {
      return createErrorResponse(
        400,
        `Invalid format. Must be one of: ${validFormats.join(", ")}`,
      );
    }

    // Sanitize posts
    const sanitizedPosts: ThreadPost[] = posts.map((post: any) => ({
      text:
        typeof post.text === "string"
          ? post.text.slice(0, 10000)
          : String(post.text || "").slice(0, 10000),
      author: String(post.author || "unknown").slice(0, 200),
      likes: Number(post.likes) || 0,
      replies: Number(post.replies) || 0,
    }));

    // Check cache
    const cacheKey = generateCacheKey(sanitizedPosts, format);
    if (!forceRefresh) {
      const cached = getCachedSummary(cacheKey);
      if (cached) {
        return createApiResponse({
          summary: cached.summary,
          format: cached.format,
          metadata: {
            ...cached.metadata,
            cached: true,
          },
        });
      }
    }

    // Build posts context
    const postsContext = sanitizedPosts
      .map(
        (post, i) =>
          `<post index="${i + 1}" author="${post.author}" likes="${post.likes}" replies="${post.replies}">
${post.text}
</post>`,
      )
      .join("\n\n");

    // Get unique authors
    const authors = [...new Set(sanitizedPosts.map((p) => p.author))];

    // Build format-specific prompts
    let formatPrompt: string;
    let maxTokens: number;

    switch (format) {
      case "haiku":
        formatPrompt = `Write a haiku (5-7-5 syllable structure) that captures the essence of this thread discussion.
The haiku should be poetic and insightful, distilling the main theme or emotional core of the conversation.
Return ONLY the haiku, three lines, no additional text or formatting.`;
        maxTokens = 100;
        break;
      case "tldr":
        formatPrompt = `Write a concise TL;DR summary of this thread conversation in 1-2 sentences (max 280 characters).
Summarize both the original post AND what the replies discuss - capture the conversation, not just the original point.
If there's debate or different viewpoints, mention that. If people agree or add context, note that.
Return ONLY the summary text, no labels or prefixes.`;
        maxTokens = 150;
        break;
      case "keypoints":
        formatPrompt = `Extract 3-5 key points from this thread discussion.
Format as a simple bullet list with each point on its own line, starting with "• ".
Keep each point concise (under 100 characters).
Return ONLY the bullet points, no headers or additional formatting.`;
        maxTokens = 300;
        break;
    }

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: `<system>
You are a thread summarizer. Analyze the following thread posts and provide a summary in the requested format.
</system>

<thread>
${postsContext}
</thread>

<task>
${formatPrompt}
</task>`,
          } as AnthropicMessage,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", error);
      return createErrorResponse(500, `AI service error: ${error}`);
    }

    const data: AnthropicResponse = await response.json();
    const summary = data.content[0].text.trim();

    const result = {
      summary,
      format,
      metadata: {
        postCount: sanitizedPosts.length,
        authors,
        generatedAt: new Date().toISOString(),
      },
    };

    // Cache the result
    setCachedSummary(cacheKey, result);

    return createApiResponse(result);
  } catch (error) {
    console.error("Error in thread-summary handler:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Internal server error",
    );
  }
};
