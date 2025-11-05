// Helper function to strip markdown code fences from JSON responses
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request for CORS
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { text, tone } = body;

    if (!text || !tone) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing text or tone" }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server API key not configured" }),
      };
    }

    const toneDescriptions: Record<string, string> = {
      professional: "formal, clear, and business-appropriate language",
      casual: "relaxed, conversational, and friendly language",
      humorous: "witty, playful, and entertaining language while maintaining the core message",
      informative: "educational, fact-focused, and explanatory language",
      inspirational: "motivating, uplifting, and encouraging language",
    };

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
            content: `Adjust the tone of this social media post to be ${toneDescriptions[tone]}.

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
      const error = await response.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Anthropic API error: ${error}` }),
      };
    }

    const data = await response.json();
    const cleanedText = cleanJsonResponse(data.content[0].text);
    const result = JSON.parse(cleanedText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error adjusting tone:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
    };
  }
};
