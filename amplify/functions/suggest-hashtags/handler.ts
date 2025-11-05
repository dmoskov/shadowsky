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
    const { text, existingTags = [] } = body;

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing text" }),
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

    const existingTagsText = existingTags.length > 0
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
    console.error("Error suggesting hashtags:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
    };
  }
};
