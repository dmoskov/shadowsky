import {
  cleanJsonResponse,
  createConfigError,
  createExternalApiError,
  createInternalError,
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

    const existingTagsText =
      existingTags.length > 0
        ? `\n\nExisting tags to avoid: ${existingTags.join(", ")}`
        : "";

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
            content: `Suggest relevant hashtags for this social media post.

Post: "${text}"${existingTagsText}

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
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(
        "suggest-hashtags",
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
      "suggest-hashtags",
      `Generated ${result.hashtags?.length || 0} hashtag suggestions`,
      correlationId,
    );

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("suggest-hashtags", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
