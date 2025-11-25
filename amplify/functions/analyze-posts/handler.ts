import {
  cleanJsonResponse,
  createConfigError,
  createExternalApiError,
  createInternalError,
  createInvalidParameterError,
  createMissingParameterError,
  createOptionsResponse,
  createSuccessResponse,
  getCorrelationId,
  isOptionsRequest,
  logError,
  logInfo,
  parseEventBody,
} from "../shared/api-response";

interface PostData {
  text: string;
  likes?: number;
  reposts?: number;
  replies?: number;
  createdAt?: string;
}

interface RequestBody {
  posts?: PostData[];
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);

    if (!body) {
      return createInvalidParameterError(
        "body",
        "Invalid JSON format",
        event,
        correlationId,
      );
    }

    const { posts } = body;

    if (!posts || !Array.isArray(posts)) {
      return createInvalidParameterError(
        "posts",
        "Must be a non-empty array",
        event,
        correlationId,
      );
    }

    if (posts.length === 0) {
      return createMissingParameterError("posts", event, correlationId);
    }

    // Limit to 50 posts for analysis
    const postsToAnalyze = posts.slice(0, 50);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo(
      "analyze-posts",
      `Analyzing ${postsToAnalyze.length} posts`,
      correlationId,
    );

    // Build the post analysis context
    const postsContext = postsToAnalyze
      .map((post: PostData, i: number) => {
        const engagement =
          (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);
        return `Post ${i + 1}:
Text: "${post.text}"
Date: ${post.createdAt || "unknown"}
Engagement: ${engagement} (${post.likes || 0} likes, ${post.reposts || 0} reposts, ${post.replies || 0} replies)`;
      })
      .join("\n\n");

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
      const errorText = await response.text();
      logError(
        "analyze-posts",
        `Anthropic API error: ${response.status}`,
        correlationId,
        {
          statusCode: response.status,
          errorText,
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

    logInfo("analyze-posts", "Analysis completed successfully", correlationId);

    return createSuccessResponse(result, event, { correlationId });
  } catch (error) {
    logError("analyze-posts", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
