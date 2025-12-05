import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  createSuccessResponse,
  createErrorResponse,
  createOptionsResponse,
  isOptionsRequest,
  ErrorCodes,
  getCorrelationId,
  logError,
  logInfo,
} from "../shared/api-response";
import {
  createAnthropicClient,
  MaxRetriesExceededError,
  TimeoutError,
} from "../shared/resilience";

interface ThreadPost {
  text: string;
  author: string;
  authorHandle?: string;
  likes: number;
  replies: number;
  reposts?: number;
  uri?: string;
  parentUri?: string;
  depth?: number;
}

// Legacy formats + Progressive complexity formats
type SummaryFormat =
  | "haiku"
  | "tldr"
  | "keypoints"
  | "extended"
  | "brief"
  | "moderate"
  | "detailed"
  | "comprehensive";

interface SubThreadHighlight {
  uri: string;
  authorHandle: string;
  snippet: string;
  engagement: number;
}

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
  const correlationId = getCorrelationId(event);

  try {
    // Handle CORS preflight requests
    if (isOptionsRequest(event)) {
      return createOptionsResponse(event);
    }

    if (event.httpMethod !== "POST") {
      return createErrorResponse(
        405,
        ErrorCodes.METHOD_NOT_ALLOWED,
        "Method not allowed",
        event,
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logError("thread-summary", "ANTHROPIC_API_KEY not configured", correlationId);
      return createErrorResponse(
        500,
        ErrorCodes.CONFIG_ERROR,
        "Server configuration error",
        event,
      );
    }

    const body = JSON.parse(event.body || "{}");
    const { posts, format = "haiku" } = body;
    const forceRefresh =
      event.queryStringParameters?.forceRefresh === "true";

    // Input validation
    if (!posts || !Array.isArray(posts)) {
      return createErrorResponse(
        400,
        ErrorCodes.MISSING_PARAMETER,
        "Missing or invalid posts array",
        event,
      );
    }

    if (posts.length === 0) {
      return createErrorResponse(
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Posts array cannot be empty",
        event,
      );
    }

    if (posts.length > 500) {
      return createErrorResponse(
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Too many posts (maximum 500 per request)",
        event,
      );
    }

    const validFormats: SummaryFormat[] = [
      "haiku",
      "tldr",
      "keypoints",
      "extended",
      "brief",
      "moderate",
      "detailed",
      "comprehensive",
    ];
    if (!validFormats.includes(format)) {
      return createErrorResponse(
        400,
        ErrorCodes.INVALID_PARAMETER,
        `Invalid format. Must be one of: ${validFormats.join(", ")}`,
        event,
      );
    }

    // Sanitize posts
    const sanitizedPosts: ThreadPost[] = posts.map((post: any) => ({
      text:
        typeof post.text === "string"
          ? post.text.slice(0, 10000)
          : String(post.text || "").slice(0, 10000),
      author: String(post.author || "unknown").slice(0, 200),
      authorHandle: post.authorHandle
        ? String(post.authorHandle).slice(0, 200)
        : undefined,
      likes: Number(post.likes) || 0,
      replies: Number(post.replies) || 0,
      reposts: Number(post.reposts) || 0,
      uri: post.uri ? String(post.uri).slice(0, 500) : undefined,
      parentUri: post.parentUri ? String(post.parentUri).slice(0, 500) : undefined,
      depth: typeof post.depth === "number" ? post.depth : undefined,
    }));

    // Calculate total engagement for metadata
    const totalEngagement = sanitizedPosts.reduce(
      (sum, p) => sum + p.likes + p.replies + (p.reposts || 0),
      0,
    );

    // Check cache
    const cacheKey = generateCacheKey(sanitizedPosts, format);
    if (!forceRefresh) {
      const cached = getCachedSummary(cacheKey);
      if (cached) {
        logInfo("thread-summary", "Cache hit", correlationId);
        return createSuccessResponse(
          {
            summary: cached.summary,
            format: cached.format,
            metadata: {
              ...cached.metadata,
              cached: true,
            },
          },
          event,
        );
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

      // Progressive complexity formats
      case "brief":
        // For simple threads (3-9 replies) - one punchy sentence
        formatPrompt = `Write ONE sentence (max 140 characters) summarizing what this thread is about.
Focus on the main topic and general sentiment of replies.
Be direct and informative - no filler words.
Return ONLY the sentence, no labels or prefixes.`;
        maxTokens = 80;
        break;

      case "moderate":
        // For moderate threads (10-29 replies) - 2-3 sentences
        formatPrompt = `Write 2-3 sentences summarizing this thread conversation (max 400 characters total).
First sentence: What's the main topic or point.
Second sentence: How did the conversation develop (agreements, debates, new angles).
Third sentence (if notable): Any interesting conclusions or standout points.
Be concise and capture the essence of the discussion.
Return ONLY the summary text, no labels or prefixes.`;
        maxTokens = 200;
        break;

      case "detailed":
        // For complex threads (30-74 replies) - paragraph with key points
        formatPrompt = `Write a detailed summary of this thread (150-250 words).
Structure:
1. Opening: What sparked this conversation (1-2 sentences)
2. Main themes: What topics emerged in the replies (2-3 sentences)
3. Key viewpoints: Different perspectives or arguments made (2-3 sentences)
4. Notable moments: Any replies that got significant engagement or shifted the conversation (1-2 sentences)
5. Closing: Where the conversation landed (1 sentence)

Be informative and help readers understand what happened in this thread without reading every reply.
Return ONLY the summary text, no labels or section headers.`;
        maxTokens = 500;
        break;

      case "comprehensive":
      case "extended":
        // For viral threads (75+ replies) - full analysis with sub-thread highlights
        formatPrompt = `Write a comprehensive analysis of this viral thread (250-400 words).

Analyze:
1. The original post and its impact (2-3 sentences)
2. Major conversation threads that emerged - what sub-topics sparked significant discussion (3-4 sentences)
3. Key participants and their contributions - who added valuable perspectives (2-3 sentences)
4. Points of agreement and disagreement - where did people align or clash (2-3 sentences)
5. How the conversation evolved over time - did the tone or focus shift (2-3 sentences)
6. Most impactful replies - which posts generated the most engagement and why (2-3 sentences)
7. Overall takeaway - what would someone miss if they skipped this thread (1-2 sentences)

After the main summary, add a section:

---HIGHLIGHTS---
List the top 3-5 most notable replies in this format:
[POST_INDEX]: @handle - Brief description of why this reply was notable (engagement/insight/controversy)

This helps readers navigate directly to the best parts of the conversation.
Return the full analysis followed by the highlights section.`;
        maxTokens = 1000;
        break;

      default:
        // Fallback to brief
        formatPrompt = `Write ONE sentence summarizing this thread. Return ONLY the sentence.`;
        maxTokens = 80;
    }

    // Create resilient client for Anthropic API with retry and timeout
    // Use longer timeout for comprehensive summaries
    const timeout =
      format === "comprehensive" || format === "extended" || format === "detailed"
        ? 30000
        : 15000;

    const client = createAnthropicClient({
      name: "thread-summary",
      timeout,
    });

    logInfo("thread-summary", `Generating ${format} summary`, correlationId, {
      postCount: sanitizedPosts.length,
    });

    try {
      const response = await client.fetch(
        "https://api.anthropic.com/v1/messages",
        {
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
        },
        correlationId
      );

      const data: AnthropicResponse = await response.json();
      let summaryText = data.content[0].text.trim();

      // Parse highlights from comprehensive/extended summaries
      let highlightedSubThreads: SubThreadHighlight[] | undefined;
      if (format === "comprehensive" || format === "extended") {
        const highlightsMatch = summaryText.match(
          /---HIGHLIGHTS---\s*([\s\S]*?)$/,
        );
        if (highlightsMatch) {
          // Extract summary without highlights section
          summaryText = summaryText.replace(/---HIGHLIGHTS---[\s\S]*$/, "").trim();

          // Parse individual highlights
          const highlightLines = highlightsMatch[1].trim().split("\n");
          highlightedSubThreads = highlightLines
            .map((line) => {
              // Format: [POST_INDEX]: @handle - Description
              const match = line.match(
                /\[(\d+)\]:\s*@(\S+)\s*-\s*(.+)/,
              );
              if (match) {
                const postIndex = parseInt(match[1], 10) - 1;
                const post = sanitizedPosts[postIndex];
                return {
                  uri: post?.uri || "",
                  authorHandle: match[2],
                  snippet: match[3].slice(0, 200),
                  engagement:
                    (post?.likes || 0) +
                    (post?.replies || 0) +
                    (post?.reposts || 0),
                };
              }
              return null;
            })
            .filter((h): h is SubThreadHighlight => h !== null && h.uri !== "");
        }
      }

      const result = {
        summary: summaryText,
        format,
        metadata: {
          postCount: sanitizedPosts.length,
          authors,
          generatedAt: new Date().toISOString(),
          totalEngagement,
          highlightedSubThreads,
        },
      };

      // Cache the result
      setCachedSummary(cacheKey, result);

      logInfo("thread-summary", "Summary generated successfully", correlationId);
      return createSuccessResponse(result, event);
    } catch (apiError) {
      if (apiError instanceof TimeoutError) {
        logError("thread-summary", apiError, correlationId, {
          errorType: "timeout",
        });
        return createErrorResponse(
          504,
          ErrorCodes.TIMEOUT,
          "AI service timed out",
          event,
        );
      }

      if (apiError instanceof MaxRetriesExceededError) {
        logError("thread-summary", apiError, correlationId, {
          attempts: apiError.attempts,
        });
        return createErrorResponse(
          500,
          ErrorCodes.EXTERNAL_API_ERROR,
          `AI service error: Failed after ${apiError.attempts} attempts`,
          event,
        );
      }

      throw apiError;
    }
  } catch (error) {
    logError("thread-summary", error, correlationId);
    return createErrorResponse(
      500,
      ErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Internal server error",
      event,
    );
  }
};
