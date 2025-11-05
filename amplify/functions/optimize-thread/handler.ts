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
    const { text, maxCharsPerPost = 300 } = body;

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

Text: "${text}"

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
    console.error("Error optimizing thread:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
    };
  }
};
