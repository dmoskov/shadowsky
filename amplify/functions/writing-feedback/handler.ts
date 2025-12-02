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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(
        "writing-feedback",
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
      "writing-feedback",
      "Feedback generated successfully",
      correlationId,
    );

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("writing-feedback", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
