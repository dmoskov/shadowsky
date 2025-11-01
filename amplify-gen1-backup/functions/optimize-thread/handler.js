// Amplify Function for optimizing thread structure

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.requestContext.http.method === "OPTIONS") {
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
            content: `Analyze this text and split it into an optimal thread for a social media platform. Each post should be under ${maxCharsPerPost} characters, self-contained, and engaging.

Rules:
1. Each segment must make sense on its own
2. Preserve the narrative flow
3. End segments with complete thoughts
4. Create natural breaks at topic transitions
5. Keep important context together
6. Suggest the best numbering format based on content type

Text to split: "${text}"

Respond with a JSON object containing:
- segments: array of {text: string, number: number, isStandalone: boolean}
- summary: brief description of the thread topic
- suggestedFormat: "simple" (1/n), "brackets" ([1/n]), "thread" (🧵), or "dots" (1.)
- totalPosts: total number of posts

Ensure the response is valid JSON.`,
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
    const result = JSON.parse(data.content[0].text);

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
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
