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
    const { posts } = body;

    if (!posts || !Array.isArray(posts)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing or invalid posts array" }),
      };
    }

    // Limit to 50 posts for analysis
    const postsToAnalyze = posts.slice(0, 50);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server API key not configured" }),
      };
    }

    // Build the post analysis context
    const postsContext = postsToAnalyze
      .map((post: any, i: number) => {
        const engagement = (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);
        return `Post ${i + 1}:
Text: "${post.text}"
Date: ${post.createdAt}
Engagement: ${engagement} (${post.likes || 0} likes, ${post.reposts || 0} reposts, ${post.replies || 0} replies)`;
      })
      .join('\n\n');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: `You are a social media analytics expert. Analyze these posts from a Bluesky user and provide insights about their content, writing style, and engagement patterns.

POSTS TO ANALYZE:
${postsContext}

Provide a comprehensive JSON response with the following structure:

{
  "contentThemes": [
    {
      "theme": "Main theme name",
      "description": "Brief description of this content theme",
      "frequency": "primary|regular|occasional",
      "examples": ["example text 1", "example text 2"]
    }
  ],
  "writingStyle": {
    "tone": "Overall tone description (e.g., 'Professional and informative', 'Casual and humorous')",
    "characteristics": ["characteristic 1", "characteristic 2", "characteristic 3"],
    "voiceDescription": "1-2 sentence description of their unique voice"
  },
  "engagementPatterns": {
    "topPerformers": ["What type of content gets the most engagement"],
    "contentStrengths": ["What they do well"],
    "suggestions": ["Actionable suggestions for improvement"]
  },
  "summary": "2-3 sentence overall summary of their content and presence"
}

IMPORTANT GUIDELINES:
1. Identify 3-5 main content themes based on recurring topics
2. For each theme, provide 1-2 short example snippets from actual posts
3. Describe their writing style characteristics (length, structure, emoji use, etc.)
4. Analyze which types of posts get the most engagement
5. Provide 2-3 actionable suggestions for improving engagement
6. Be specific and constructive
7. Base everything on actual data from the posts
8. Your response MUST be valid JSON only - start with { and end with }`,
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
    console.error("Error analyzing posts:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
    };
  }
};
