import {
  cleanJsonResponse,
  createConfigError,
  createExternalApiError,
  createInternalError,
  createInvalidParameterError,
  createMissingParameterError,
  createOptionsResponse,
  createSuccessResponse,
  getCorrelationId,
  isOptionsRequest,
  logError,
  logInfo,
  parseEventBody,
} from "../shared/api-response";

interface RequestBody {
  currentText?: string;
  historicalPosts?: string[];
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { currentText, historicalPosts } = body || {};

    if (!currentText) {
      return createMissingParameterError("currentText", event, correlationId);
    }

    if (!historicalPosts || !Array.isArray(historicalPosts)) {
      return createInvalidParameterError(
        "historicalPosts",
        "Must be an array of strings",
        event,
        correlationId,
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo(
      "style-analysis",
      `Analyzing style against ${historicalPosts.length} historical posts`,
      correlationId,
    );

    // Truncate long posts to avoid context size issues
    const truncateText = (text: string, max: number = 500): string =>
      text.length <= max ? text : text.substring(0, max - 3) + "...";

    // Build the historical posts context
    const historicalContext = historicalPosts
      .slice(0, 20) // Limit to 20 most recent posts
      .map((post, i) => `${i + 1}. ${truncateText(post)}`)
      .join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are a writing style analyst. Analyze the user's writing style based on their historical posts, then compare their current draft to that style.

HISTORICAL POSTS:
${historicalContext}

CURRENT DRAFT:
"${truncateText(currentText, 1000)}"

Provide a JSON response with:
1. userStyleSummary: A 1-2 sentence description of their typical writing style (tone, patterns, word choice, post length, emoji usage, etc.)
2. matchesStyle: boolean indicating if the current draft matches their typical style
3. styleNotes: array of 2-4 specific observations about how this draft compares to their style (e.g., "Usually more casual", "Typically uses more emojis", "Shorter than usual posts", "More formal tone than typical")

Example JSON structure:
{
  "userStyleSummary": "Your posts are typically casual and conversational with frequent emoji use. You tend to keep things brief and punchy.",
  "matchesStyle": true,
  "styleNotes": [
    "Matches your usual conversational tone",
    "Similar length to your typical posts",
    "Consistent emoji usage"
  ]
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Keep userStyleSummary to 1-2 sentences maximum
2. Include 2-4 specific, actionable styleNotes
3. Base analysis on actual patterns from historical posts
4. Be constructive and helpful, not critical
5. Start directly with { and end with }`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(
        "style-analysis",
        `Anthropic API error: ${response.status}`,
        correlationId,
        {
          statusCode: response.status,
        },
      );
      return createExternalApiError(
        "Anthropic",
        errorText,
        event,
        correlationId,
      );
    }

    const data = await response.json();
    const cleanedText = cleanJsonResponse(data.content[0].text);
    const result = JSON.parse(cleanedText);

    logInfo(
      "style-analysis",
      "Style analysis completed successfully",
      correlationId,
    );

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("style-analysis", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
