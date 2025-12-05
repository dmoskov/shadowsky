import {
  cleanJsonResponse,
  createConfigError,
  createExternalApiError,
  createInternalError,
  createMissingParameterError,
  createOptionsResponse,
  createSuccessResponse,
  createTimeoutError,
  getCorrelationId,
  isOptionsRequest,
  logError,
  logInfo,
  parseEventBody,
} from "../shared/api-response";
import {
  createAnthropicClient,
  MaxRetriesExceededError,
  TimeoutError,
} from "../shared/resilience";

interface RequestBody {
  text?: string;
  existingTags?: string[];
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { text, existingTags = [] } = body || {};

    if (!text) {
      return createMissingParameterError("text", event, correlationId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo(
      "suggest-hashtags",
      "Generating hashtag suggestions",
      correlationId,
    );

    // Truncate very long text to avoid context issues
    const truncatedText = text.length > 1000 ? text.substring(0, 997) + "..." : text;

    const existingTagsText =
      existingTags.length > 0
        ? `\n\nExisting tags to avoid: ${existingTags.join(", ")}`
        : "";

    // Create resilient client for Anthropic API with retry and timeout
    const client = createAnthropicClient({ name: "suggest-hashtags" });

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
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: `Suggest relevant hashtags for this social media post.

Post: "${truncatedText}"${existingTagsText}

Provide a JSON response with:
{
  "hashtags": [
    {
      "tag": "hashtag name without #",
      "relevance": 0.0 to 1.0 score,
      "isTrending": true/false
    }
  ],
  "category": "main category of the post (e.g., Technology, Sports, Entertainment)"
}

Guidelines:
- Suggest 3-8 relevant hashtags
- Order by relevance (most relevant first)
- Mix of specific and general tags
- Consider actual trending topics when possible
- Don't duplicate existing tags
- Use proper capitalization (e.g., "JavaScript" not "javascript")

Your response MUST be valid JSON only.`,
              },
            ],
          }),
        },
        correlationId
      );

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      logInfo(
        "suggest-hashtags",
        `Generated ${result.hashtags?.length || 0} hashtag suggestions`,
        correlationId,
      );

      return createSuccessResponse(result, event, { correlationId });
    } catch (apiError) {
      if (apiError instanceof TimeoutError) {
        logError("suggest-hashtags", apiError, correlationId, {
          errorType: "timeout",
        });
        return createTimeoutError("Anthropic API call", event, correlationId);
      }

      if (apiError instanceof MaxRetriesExceededError) {
        logError("suggest-hashtags", apiError, correlationId, {
          attempts: apiError.attempts,
        });
        return createExternalApiError(
          "Anthropic",
          `Failed after ${apiError.attempts} attempts`,
          event,
          correlationId
        );
      }

      throw apiError;
    }
  } catch (error) {
    logError("suggest-hashtags", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
