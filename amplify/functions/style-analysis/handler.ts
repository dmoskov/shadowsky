// Helper function to strip markdown code fences from JSON responses
function cleanJsonResponse(text: string): string {
  // Remove markdown code fences if present
  let cleaned = text.trim();

  // Remove ```json or ``` at the start
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  // Remove ``` at the end
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
    const { currentText, historicalPosts } = body;

    if (!currentText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing currentText" }),
      };
    }

    if (!historicalPosts || !Array.isArray(historicalPosts)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing or invalid historicalPosts array" }),
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

    // Build the historical posts context
    const historicalContext = historicalPosts
      .slice(0, 20) // Limit to 20 most recent posts
      .map((post: string, i: number) => `${i + 1}. ${post}`)
      .join('\n');

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
            content: `You are a writing style analyst. Analyze the user's writing style based on their historical posts, then compare their current draft to that style.

HISTORICAL POSTS:
${historicalContext}

CURRENT DRAFT:
"${currentText}"

Provide a JSON response with:
1. userStyleSummary: A 1-2 sentence description of their typical writing style (tone, patterns, word choice, post length, emoji usage, etc.)
2. matchesStyle: boolean indicating if the current draft matches their typical style
3. styleNotes: array of 2-4 specific observations about how this draft compares to their style (e.g., "Usually more casual", "Typically uses more emojis", "Shorter than usual posts", "More formal tone than typical")

Example JSON structure:
{
  "userStyleSummary": "Your posts are typically casual and conversational with frequent emoji use. You tend to keep things brief and punchy.",
  "matchesStyle": true,
  "styleNotes": [
    "Matches your usual conversational tone",
    "Similar length to your typical posts",
    "Consistent emoji usage"
  ]
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Keep userStyleSummary to 1-2 sentences maximum
2. Include 2-4 specific, actionable styleNotes
3. Base analysis on actual patterns from historical posts
4. Be constructive and helpful, not critical
5. Start directly with { and end with }`,
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
    console.error("Error analyzing writing style:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
    };
  }
};
