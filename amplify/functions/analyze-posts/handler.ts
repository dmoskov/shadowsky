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
} from "../shared/api-response";
import {
  authenticateRequest,
  createUnauthorizedResponse,
  type AuthResult,
} from "../shared/cognito-auth";
import {
  checkUserRateLimit,
  createUserRateLimitResponse,
  STRICT_USER_RATE_LIMIT,
} from "../shared/user-rate-limiter";

interface PostData {
  text: string;
  likes?: number;
  reposts?: number;
  replies?: number;
  createdAt?: string;
}

interface TimeSlotAnalysis {
  hour: number;
  dayOfWeek: number;
  postCount: number;
  totalEngagement: number;
  avgEngagement: number;
}

function analyzePostingTimes(posts: PostData[]): {
  timeSlots: TimeSlotAnalysis[];
  optimalTimes: {
    hour: number;
    dayOfWeek: number;
    avgEngagement: number;
    confidence: string;
  }[];
  hourlyEngagement: number[];
  weekdayEngagement: number[];
} {
  // Initialize hourly and day-of-week tracking
  const hourlyData: { count: number; engagement: number }[] = Array(24)
    .fill(null)
    .map(() => ({ count: 0, engagement: 0 }));
  const weekdayData: { count: number; engagement: number }[] = Array(7)
    .fill(null)
    .map(() => ({ count: 0, engagement: 0 }));
  const timeSlotMap = new Map<string, TimeSlotAnalysis>();

  for (const post of posts) {
    if (!post.createdAt) continue;

    const date = new Date(post.createdAt);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const engagement =
      (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);

    // Track hourly data
    hourlyData[hour].count++;
    hourlyData[hour].engagement += engagement;

    // Track weekday data
    weekdayData[dayOfWeek].count++;
    weekdayData[dayOfWeek].engagement += engagement;

    // Track time slot (hour + day combination)
    const key = `${dayOfWeek}-${hour}`;
    if (!timeSlotMap.has(key)) {
      timeSlotMap.set(key, {
        hour,
        dayOfWeek,
        postCount: 0,
        totalEngagement: 0,
        avgEngagement: 0,
      });
    }
    const slot = timeSlotMap.get(key)!;
    slot.postCount++;
    slot.totalEngagement += engagement;
    slot.avgEngagement = slot.totalEngagement / slot.postCount;
  }

  // Calculate average engagement by hour
  const hourlyEngagement = hourlyData.map((d) =>
    d.count > 0 ? d.engagement / d.count : 0,
  );

  // Calculate average engagement by weekday
  const weekdayEngagement = weekdayData.map((d) =>
    d.count > 0 ? d.engagement / d.count : 0,
  );

  // Find optimal times (top 3 time slots with enough data)
  const timeSlots = Array.from(timeSlotMap.values())
    .filter((slot) => slot.postCount >= 2) // Need at least 2 posts for statistical significance
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Determine confidence based on sample size
  const getConfidence = (postCount: number): string => {
    if (postCount >= 10) return "high";
    if (postCount >= 5) return "medium";
    return "low";
  };

  const optimalTimes = timeSlots.slice(0, 3).map((slot) => ({
    hour: slot.hour,
    dayOfWeek: slot.dayOfWeek,
    avgEngagement: Math.round(slot.avgEngagement * 10) / 10,
    confidence: getConfidence(slot.postCount),
  }));

  // If we don't have enough time slot data, fall back to best hours
  if (optimalTimes.length < 3) {
    const bestHours = hourlyData
      .map((d, hour) => ({
        hour,
        count: d.count,
        avg: d.count > 0 ? d.engagement / d.count : 0,
      }))
      .filter((h) => h.count >= 2)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3 - optimalTimes.length);

    for (const h of bestHours) {
      optimalTimes.push({
        hour: h.hour,
        dayOfWeek: -1, // -1 indicates "any day"
        avgEngagement: Math.round(h.avg * 10) / 10,
        confidence: getConfidence(h.count),
      });
    }
  }

  return {
    timeSlots,
    optimalTimes,
    hourlyEngagement: hourlyEngagement.map((e) => Math.round(e * 10) / 10),
    weekdayEngagement: weekdayEngagement.map((e) => Math.round(e * 10) / 10),
  };
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
    // Authenticate the request
    const auth: AuthResult = await authenticateRequest(event);

    if (!auth.authenticated) {
      logInfo(
        "analyze-posts",
        `Authentication failed: ${auth.error}`,
        correlationId,
      );
      return createUnauthorizedResponse(
        auth.error || "Authentication required",
        event,
        correlationId,
      );
    }

    const userId = auth.userId!;

    // Apply per-user rate limiting
    // Using strict rate limit (5 requests/minute) as this is an expensive operation
    const rateLimitResult = checkUserRateLimit(userId, STRICT_USER_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      logInfo(
        "analyze-posts",
        `Rate limit exceeded for user: ${userId}`,
        correlationId,
        {
          retryAfter: rateLimitResult.retryAfter,
        },
      );
      return createUserRateLimitResponse(
        event,
        correlationId,
        rateLimitResult.retryAfter,
        STRICT_USER_RATE_LIMIT.message,
      );
    }

    logInfo(
      "analyze-posts",
      `Request authenticated for user: ${userId}`,
      correlationId,
    );

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

    // Limit to 25 posts for analysis (reduced to avoid context size issues)
    const postsToAnalyze = posts.slice(0, 25);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createConfigError("ANTHROPIC_API_KEY", event, correlationId);
    }

    logInfo(
      "analyze-posts",
      `Analyzing ${postsToAnalyze.length} posts for user ${userId}`,
      correlationId,
    );

    // Truncate long posts to avoid exceeding Claude's context limits
    const truncatePostText = (text: string, maxLength: number = 500): string => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + "...";
    };

    // Build the post analysis context
    const postsContext = postsToAnalyze
      .map((post: PostData, i: number) => {
        const engagement =
          (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);
        return `Post ${i + 1}:
Text: "${truncatePostText(post.text)}"
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
    const aiResult = JSON.parse(cleanedText);

    // Calculate optimal posting times from the raw data
    const postingTimeData = analyzePostingTimes(postsToAnalyze);

    // Merge AI analysis with posting time analysis
    const result = {
      ...aiResult,
      optimalPostingTimes: {
        recommendations: postingTimeData.optimalTimes,
        hourlyEngagement: postingTimeData.hourlyEngagement,
        weekdayEngagement: postingTimeData.weekdayEngagement,
        lastCalculated: new Date().toISOString(),
      },
    };

    logInfo(
      "analyze-posts",
      `Analysis completed successfully for user ${userId}`,
      correlationId,
    );

    // Add rate limit headers to response
    const successResponse = createSuccessResponse(result, event, {
      correlationId,
    });
    if (successResponse.headers) {
      successResponse.headers["X-RateLimit-Limit"] = String(
        STRICT_USER_RATE_LIMIT.maxRequests,
      );
      successResponse.headers["X-RateLimit-Remaining"] = String(
        rateLimitResult.remaining,
      );
      successResponse.headers["X-RateLimit-Window"] = String(
        STRICT_USER_RATE_LIMIT.windowMs / 1000,
      );
    }

    return successResponse;
  } catch (error) {
    logError("analyze-posts", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};

// Re-export parseEventBody from api-response for local use
function parseEventBody<T>(event: any): T | null {
  try {
    return JSON.parse(event.body || "{}") as T;
  } catch {
    return null;
  }
}
