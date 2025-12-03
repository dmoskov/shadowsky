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
  maxCharsPerPost?: number;
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { text, maxCharsPerPost = 300 } = body || {};

    if (!text) {
      return createMissingParameterError("text", event, correlationId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo(
      "optimize-thread",
      `Optimizing thread with max ${maxCharsPerPost} chars/post`,
      correlationId,
    );

    // Truncate very long text to avoid context issues (5000 chars is reasonable for thread splitting)
    const truncatedText = text.length > 5000 ? text.substring(0, 4997) + "..." : text;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Optimize this text for a social media thread with a maximum of ${maxCharsPerPost} characters per post.

Text: "${truncatedText}"

Analyze the content and provide a JSON response with:
{
  "segments": [
    {
      "text": "first post content",
      "number": 1,
      "isStandalone": true/false
    }
  ],
  "summary": "brief summary of what the thread is about",
  "suggestedFormat": "simple" | "brackets" | "thread" | "dots",
  "totalPosts": number
}

Thread format guidelines:
- "simple": Just post numbers (1., 2., 3.)
- "brackets": Bracketed numbers ([1/n], [2/n])
- "thread": Thread emoji format (🧵 1/n)
- "dots": Dot separators (• Post 1)

Rules:
- Each segment must be under ${maxCharsPerPost} characters
- Break at natural points (sentences, paragraphs)
- Maintain narrative flow
- Mark segments as standalone if they make sense independently
- Choose the most appropriate format based on content type

Your response MUST be valid JSON only.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(
        "optimize-thread",
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
      "optimize-thread",
      `Thread optimized into ${result.totalPosts} segments`,
      correlationId,
    );

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("optimize-thread", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
