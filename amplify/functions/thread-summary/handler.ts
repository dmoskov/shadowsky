import {
  createSuccessResponse,
  createErrorResponse,
  ErrorCodes,
  logError,
  logInfo,
} from "../shared/api-response";
import { withCommonSetup, type MiddlewareContext } from "../shared/middleware";
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
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
}

export const handler = withCommonSetup({
  name: 'thread-summary',
  enableWarmup: true,
  requireApiKey: true,
})(async (event: any, { correlationId, apiKey }: MiddlewareContext) => {
  if (event.httpMethod !== "POST") {
    return createErrorResponse(
      405,
      ErrorCodes.METHOD_NOT_ALLOWED,
      "Method not allowed",
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

  // Smart filtering for large threads to avoid exceeding Claude's context limit
  // Strategy: Keep root + engaged posts, filter noise, limit by token estimate
  const MAX_CONTEXT_CHARS = 400000; // ~100k tokens, leaves room for prompt
  const MAX_POSTS_FOR_SUMMARY = 150; // Hard cap on posts to analyze

  let postsForSummary = sanitizedPosts;

  if (sanitizedPosts.length > 50) {
    // For large threads, filter intelligently
    const getEngagement = (p: ThreadPost) => p.likes + p.replies + (p.reposts || 0);

    // Separate root post (depth 0 or first post) from replies
    const rootPost = sanitizedPosts.find(p => p.depth === 0) || sanitizedPosts[0];
    const otherPosts = sanitizedPosts.filter(p => p !== rootPost);

    // Filter out zero-engagement posts (noise)
    const engagedPosts = otherPosts.filter(p => getEngagement(p) > 0);

    // If we still have too many, sort by engagement and take top posts
    let selectedPosts: ThreadPost[];
    if (engagedPosts.length > MAX_POSTS_FOR_SUMMARY - 1) {
      // Sort by engagement descending, take top posts
      selectedPosts = engagedPosts
        .sort((a, b) => getEngagement(b) - getEngagement(a))
        .slice(0, MAX_POSTS_FOR_SUMMARY - 1);
    } else if (engagedPosts.length < 20 && otherPosts.length > engagedPosts.length) {
      // If very few engaged posts, include some zero-engagement for context
      // Take engaged posts + earliest zero-engagement posts up to 50 total
      const zeroEngagement = otherPosts
        .filter(p => getEngagement(p) === 0)
        .slice(0, 50 - engagedPosts.length);
      selectedPosts = [...engagedPosts, ...zeroEngagement];
    } else {
      selectedPosts = engagedPosts;
    }

    // Always include root post first
    postsForSummary = [rootPost, ...selectedPosts];

    // Final check: estimate total characters and truncate if needed
    let totalChars = 0;
    const finalPosts: ThreadPost[] = [];
    for (const post of postsForSummary) {
      const postChars = post.text.length + (post.authorHandle?.length || post.author.length) + 50; // overhead
      if (totalChars + postChars > MAX_CONTEXT_CHARS && finalPosts.length > 0) {
        break;
      }
      finalPosts.push(post);
      totalChars += postChars;
    }
    postsForSummary = finalPosts;

    logInfo("thread-summary", "Filtered posts for large thread", correlationId, {
      originalCount: sanitizedPosts.length,
      afterEngagementFilter: engagedPosts.length + 1,
      finalCount: postsForSummary.length,
      estimatedChars: totalChars,
    });
  }

  // Check cache
  const cacheKey = generateCacheKey(postsForSummary, format);
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

  // Build posts context - use author handles, no index numbers
  const postsContext = postsForSummary
    .map(
      (post) =>
        `<post author="@${post.authorHandle || post.author}">
${post.text}
</post>`,
    )
    .join("\n\n");

  // Get unique authors (from filtered posts)
  const authors = [...new Set(postsForSummary.map((p) => p.author))];

  // Build format-specific prompts
  // Key principles:
  // - Describe the actual content, not meta-commentary about the thread
  // - Never reference post numbers or indexes
  // - Use @handles when mentioning specific people
  // - Focus on what was said, not how many people said it
  let formatPrompt: string;
  let maxTokens: number;

  switch (format) {
    case "haiku":
      formatPrompt = `Write a haiku (5-7-5 syllable structure) that captures the essence of this conversation.
The haiku should be poetic and evocative, distilling the main theme or feeling.
Return ONLY the haiku, three lines, no additional text.`;
      maxTokens = 100;
      break;

    case "tldr":
      formatPrompt = `Summarize this conversation in 1-2 sentences (max 280 characters).
Describe what was discussed and any key conclusions or disagreements.
Write it as a direct description, not meta-commentary (e.g., "X argues that..." not "This thread discusses...").
Return ONLY the summary, no labels or prefixes.`;
      maxTokens = 150;
      break;

    case "keypoints":
      formatPrompt = `Extract 3-5 key points from this conversation.
Format as a bullet list with each point on its own line, starting with "• ".
Each point should describe an actual idea or argument, not meta-commentary.
Keep each point concise (under 100 characters).
Return ONLY the bullet points, no headers.`;
      maxTokens = 300;
      break;

    // Progressive complexity formats
    case "brief":
      // For simple threads (3-9 replies) - one punchy sentence
      formatPrompt = `Summarize this conversation in ONE sentence (max 140 characters).
Describe the main topic and conclusion/sentiment directly.
Write as a factual description, not meta-commentary.
Return ONLY the sentence, no labels.`;
      maxTokens = 80;
      break;

    case "moderate":
      // For moderate threads (10-29 replies) - 2-3 sentences
      formatPrompt = `Summarize this conversation in 2-3 sentences (max 400 characters).
Describe what was discussed and how the conversation developed.
Use @handles when referencing specific people's contributions.
Write as a direct description, not meta-commentary about "the thread."
Return ONLY the summary, no labels.`;
      maxTokens = 200;
      break;

    case "detailed":
      // For complex threads (30-74 replies) - paragraph with key points
      formatPrompt = `Write a summary of this conversation (150-250 words).
Cover:
- What started the discussion
- The main ideas and arguments that emerged
- Different perspectives people shared (use @handles)
- Any conclusions or unresolved debates

Write as a flowing narrative describing the actual content.
Do NOT use meta-commentary like "this thread explores" or "users discuss."
Do NOT reference post numbers.
Return ONLY the summary, no section headers.`;
      maxTokens = 500;
      break;

    case "comprehensive":
    case "extended":
      // For viral threads (75+ replies) - full analysis with highlights
      formatPrompt = `Write a comprehensive summary of this conversation (250-400 words).

Describe:
- What sparked the conversation and the original point
- The main topics and arguments that emerged
- Key contributors and their perspectives (use @handles)
- Points of agreement and disagreement
- How the conversation evolved
- The overall takeaway

Write as a flowing narrative describing the actual content of the conversation.
Do NOT use meta-commentary like "this thread explores" or "the discussion centers on."
Do NOT reference post numbers or indexes.
When mentioning specific people, use their @handle.

After the main summary, add a section:

---HIGHLIGHTS---
List 3-5 notable replies worth reading. For each, use this EXACT format:
@handle: "brief quote from their post" - why it's notable

Example:
@alice: "The real issue isn't the policy itself" - Reframes the debate around implementation
@bob: "I worked on this exact problem at Google" - Adds insider perspective

Use actual quotes from the posts (shortened if needed). This helps readers find specific replies.`;
      maxTokens = 1000;
      break;

    default:
      // Fallback to brief
      formatPrompt = `Summarize this conversation in ONE sentence. Return ONLY the sentence.`;
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
    analyzedCount: postsForSummary.length,
    wasFiltered: postsForSummary.length < sanitizedPosts.length,
  });

  try {
    const response = await client.fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey!,
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
You are a conversation summarizer. Your job is to describe what people actually said, not to provide meta-commentary about the conversation itself.

Key rules:
- Describe the actual content and ideas, not "the thread" or "users"
- Never reference post numbers or indexes
- Use @handles when mentioning specific contributors
- Write as if explaining what happened to someone who wasn't there
</system>

<conversation>
${postsContext}
</conversation>

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
        // Format: @handle: "quote" - description
        const highlightLines = highlightsMatch[1].trim().split("\n").filter(line => line.trim());
        highlightedSubThreads = highlightLines
          .map((line) => {
            // Match: @handle: "quote" - description
            const match = line.match(
              /@(\S+):\s*"([^"]+)"\s*-\s*(.+)/,
            );
            if (match) {
              const handle = match[1];
              const quote = match[2];
              const description = match[3];

              // Find the post by matching handle and quote content
              const post = sanitizedPosts.find(
                p => (p.authorHandle === handle || p.author === handle) &&
                     p.text.toLowerCase().includes(quote.toLowerCase().slice(0, 30))
              );

              return {
                uri: post?.uri || "",
                authorHandle: handle,
                snippet: `"${quote}" - ${description}`,
                engagement:
                  (post?.likes || 0) +
                  (post?.replies || 0) +
                  (post?.reposts || 0),
              };
            }
            return null;
          })
          .filter((h): h is SubThreadHighlight => h !== null);
      }
    }

    const result = {
      summary: summaryText,
      format,
      metadata: {
        postCount: sanitizedPosts.length,
        analyzedPostCount: postsForSummary.length,
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
});
