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
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { text } = body || {};

    if (!text) {
      return createMissingParameterError("text", event, correlationId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo("writing-feedback", "Processing feedback request", correlationId);

    // Truncate very long text to avoid context issues
    const truncatedText = text.length > 2000 ? text.substring(0, 1997) + "..." : text;

    // Create resilient client for Anthropic API with retry and timeout
    const client = createAnthropicClient({ name: "writing-feedback" });

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
            max_tokens: 1500,
            messages: [
              {
                role: "user",
                content: `Analyze this social media post and provide helpful feedback with improved versions.

Post: "${truncatedText}"

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
          }),
        },
        correlationId
      );

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      logInfo(
        "writing-feedback",
        "Feedback generated successfully",
        correlationId,
      );

      return createSuccessResponse(result, event, { correlationId });
    } catch (apiError) {
      if (apiError instanceof TimeoutError) {
        logError("writing-feedback", apiError, correlationId, {
          errorType: "timeout",
        });
        return createTimeoutError("Anthropic API call", event, correlationId);
      }

      if (apiError instanceof MaxRetriesExceededError) {
        logError("writing-feedback", apiError, correlationId, {
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
    logError("writing-feedback", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
