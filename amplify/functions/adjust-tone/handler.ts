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
  tone?: string;
}

const toneDescriptions: Record<string, string> = {
  professional: "formal, clear, and business-appropriate language",
  casual: "relaxed, conversational, and friendly language",
  humorous:
    "witty, playful, and entertaining language while maintaining the core message",
  informative: "educational, fact-focused, and explanatory language",
  inspirational: "motivating, uplifting, and encouraging language",
};

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { text, tone } = body || {};

    if (!text) {
      return createMissingParameterError("text", event, correlationId);
    }

    if (!tone) {
      return createMissingParameterError("tone", event, correlationId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo("adjust-tone", `Adjusting tone to: ${tone}`, correlationId);

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
            content: `Adjust the tone of this social media post to be ${toneDescriptions[tone] || tone}.

Original post: "${text}"

Provide a JSON response with:
{
  "adjustedText": "the rewritten post with the new tone",
  "originalText": "${text}",
  "tone": "${tone}"
}

Important:
- Keep the core message and meaning the same
- Match the character count as closely as possible
- Preserve any hashtags, mentions, or links
- Make the changes subtle and natural

Your response MUST be valid JSON only. Start with { and end with }.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(
        "adjust-tone",
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

    logInfo("adjust-tone", "Tone adjusted successfully", correlationId);

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("adjust-tone", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
