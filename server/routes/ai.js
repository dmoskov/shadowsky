/**
 * AI-Powered API Routes
 *
 * Endpoints that use Claude AI for content generation and analysis.
 * All routes are protected by Cognito auth + AI rate limiting.
 */

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const { requireCognitoAuth } = require("../middleware/cognito-auth");
const { aiEndpointLimiter } = require("../middleware/rate-limit");
const { validateUrlForSSRF } = require("../ip-validator");
const { cleanJsonResponse, decodeHtmlEntities } = require("../utils/helpers");
const {
  generateCacheKey,
  getCachedSummary,
  setCachedSummary,
  generateProfileCacheKey,
  getCachedProfileAnalysis,
  setCachedProfileAnalysis,
} = require("../utils/cache");

/**
 * POST /api/generate-alt-text
 * Generate alt text for an image URL using Claude AI
 */
router.post(
  "/generate-alt-text",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { imageUrl } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    console.log("Alt text generation request:", {
      imageUrl,
      hasServerApiKey: !!apiKey,
    });

    if (!imageUrl) {
      return res.status(400).json({ error: "Missing imageUrl" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      let base64Image;
      let mimeType;

      // Handle data URLs (base64 encoded images)
      if (imageUrl.startsWith("data:")) {
        console.log("Processing data URL");
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid data URL format");
        }
        mimeType = matches[1];
        base64Image = matches[2];
      } else {
        // Convert relative URLs to absolute URLs
        let absoluteUrl = imageUrl;
        if (imageUrl.startsWith("/bsky-cdn/")) {
          absoluteUrl = imageUrl.replace("/bsky-cdn/", "https://cdn.bsky.app/");
        } else if (imageUrl.startsWith("/bsky-video/")) {
          absoluteUrl = imageUrl.replace(
            "/bsky-video/",
            "https://video.bsky.app/",
          );
        } else if (imageUrl.startsWith("/bsky-video-cdn/")) {
          absoluteUrl = imageUrl.replace(
            "/bsky-video-cdn/",
            "https://video.cdn.bsky.app/",
          );
        } else if (
          !imageUrl.startsWith("http://") &&
          !imageUrl.startsWith("https://")
        ) {
          absoluteUrl = `http://localhost:5174${imageUrl}`;
        }

        // SSRF Protection
        const ssrfValidation = await validateUrlForSSRF(absoluteUrl);
        if (!ssrfValidation.valid) {
          console.warn(
            `SSRF blocked for alt-text URL: ${absoluteUrl} - ${ssrfValidation.error}`,
            ssrfValidation.resolvedIP
              ? `(IP: ${ssrfValidation.resolvedIP})`
              : "",
          );
          return res.status(403).json({
            error: "Request blocked for security reasons",
          });
        }

        console.log("Fetching image from:", absoluteUrl);
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
          console.error(
            "Image fetch failed:",
            response.status,
            response.statusText,
          );
          throw new Error(
            `Failed to fetch image: ${response.status} ${response.statusText}`,
          );
        }

        const buffer = await response.buffer();
        base64Image = buffer.toString("base64");
        mimeType = response.headers.get("content-type") || "image/jpeg";
      }

      // Call Anthropic API
      const anthropicResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            // ~700 tokens comfortably covers up to 2000 characters of alt text.
            max_tokens: 700,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: base64Image,
                    },
                  },
                  {
                    type: "text",
                    text: "Generate alt text for this image that would help someone using a screen reader understand what's shown. Keep it concise (most descriptions should be brief), but you can use up to 2000 characters when needed for complex images. Focus on the main subject and action.",
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!anthropicResponse.ok) {
        const error = await anthropicResponse.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await anthropicResponse.json();
      // Bluesky enforces a 2000-character alt-text limit; truncate with a small
      // margin so we never exceed it even if the model runs slightly long.
      const altText = data.content[0].text.slice(0, 1990);

      res.set(
        "Cache-Control",
        "public, max-age=120, stale-while-revalidate=300",
      );
      res.json({ altText });
    } catch (error) {
      console.error("Error generating alt text:", error);
      res.status(500).json({
        error: "Failed to generate alt text",
      });
    }
  },
);

/**
 * POST /api/writing-feedback
 * Get writing feedback for a social media post
 */
router.post(
  "/writing-feedback",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { text } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
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
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      res.json(result);
    } catch (error) {
      console.error("Error getting writing feedback:", error);
      res.status(500).json({
        error: "Failed to get writing feedback",
      });
    }
  },
);

/**
 * POST /api/style-analysis
 * Analyze writing style based on historical posts
 */
router.post(
  "/style-analysis",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { currentText, historicalPosts } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!currentText) {
      return res.status(400).json({ error: "Missing currentText" });
    }

    if (!historicalPosts || !Array.isArray(historicalPosts)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid historicalPosts array" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      const historicalContext = historicalPosts
        .slice(0, 20)
        .map((post, i) => `${i + 1}. ${post}`)
        .join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
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
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      res.json(result);
    } catch (error) {
      console.error("Error analyzing writing style:", error);
      res.status(500).json({
        error: "Failed to analyze writing style",
      });
    }
  },
);

/**
 * POST /api/adjust-tone
 * Adjust the tone of a post
 */
router.post(
  "/adjust-tone",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { text, tone } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!text || !tone) {
      return res.status(400).json({ error: "Missing text or tone" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Rewrite this social media post in a ${tone} tone while preserving the core message:

"${text}"

Respond with ONLY the rewritten text, no explanations or quotes.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const adjustedText = data.content[0].text.trim();

      res.json({
        adjustedText,
        originalText: text,
        tone,
      });
    } catch (error) {
      console.error("Error adjusting tone:", error);
      res.status(500).json({
        error: "Failed to adjust tone",
      });
    }
  },
);

/**
 * POST /api/optimize-thread
 * Optimize thread structure for multiple posts
 */
router.post(
  "/optimize-thread",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { text, maxCharsPerPost = 300 } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `Split this text into a well-structured thread with posts under ${maxCharsPerPost} characters each:

"${text}"

Provide a JSON response with:
- segments: array of {text, number, isStandalone} objects
- summary: brief description of the thread structure
- suggestedFormat: one of "simple", "brackets", "thread", "dots"
- totalPosts: number of posts

Start directly with { and end with }`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      res.json(result);
    } catch (error) {
      console.error("Error optimizing thread:", error);
      res.status(500).json({
        error: "Failed to optimize thread",
      });
    }
  },
);

/**
 * POST /api/suggest-hashtags
 * Suggest relevant hashtags for a post
 */
router.post(
  "/suggest-hashtags",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { text, existingTags = [] } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Suggest 3-5 relevant hashtags for this social media post${existingTags.length > 0 ? `, avoiding these existing tags: ${existingTags.join(", ")}` : ""}:

"${text}"

Provide a JSON response with:
- hashtags: array of {tag, relevance, isTrending} objects
- category: general content category

Start directly with { and end with }`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      res.json(result);
    } catch (error) {
      console.error("Error suggesting hashtags:", error);
      res.status(500).json({
        error: "Failed to suggest hashtags",
      });
    }
  },
);

/**
 * POST /api/analyze-posts
 * Analyze user posts qualitatively
 */
router.post(
  "/analyze-posts",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { posts, analysisType = "sonnet" } = req.body;
    const forceRefresh = req.query.forceRefresh === "true";
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: "Missing or invalid posts array" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    // Check cache first
    const cacheKey = generateProfileCacheKey(posts, analysisType);
    if (!forceRefresh) {
      const cached = getCachedProfileAnalysis(cacheKey);
      if (cached) {
        res.set(
          "Cache-Control",
          "public, max-age=120, stale-while-revalidate=300",
        );
        return res.json({
          ...cached,
          cached: true,
          generatedAt: new Date(cached.generatedAt).toISOString(),
        });
      }
    }

    try {
      const samplePosts = posts.slice(0, 50);

      const postsContext = samplePosts
        .map((post, i) => {
          const engagement = `Likes: ${post.likes}, Reposts: ${post.reposts}, Replies: ${post.replies}`;
          return `Post ${i + 1} (${engagement}):\n"${post.text}"\nDate: ${post.createdAt}`;
        })
        .join("\n\n");

      const isHaiku = analysisType === "haiku";
      const maxTokens = isHaiku ? 200 : 3000;

      const prompt = isHaiku
        ? `You are a social media analyst. Quickly analyze these posts and provide a BRIEF JSON response.

USER'S POSTS:
${postsContext}

Provide a concise JSON response with ONLY:
1. **summary**: A punchy 3-sentence characterization of this user (who they are, what they write about, their vibe)

Keep it under 100 words total. Start directly with { and end with }.

Example:
{
  "summary": "A tech enthusiast who shares insights about AI and programming. Writes in a conversational, approachable style with occasional humor. Focuses on practical applications and real-world examples."
}`
        : `You are a social media analyst. Analyze these posts from a single user to provide a qualitative characterization of their content and style.

USER'S POSTS:
${postsContext}

Provide a comprehensive JSON response with:

1. **contentThemes**: Array of 3-5 main themes/topics the user posts about, each with:
   - theme: string (e.g., "Technology & AI", "Personal Development")
   - description: string (1-2 sentences explaining this theme)
   - frequency: "primary" | "regular" | "occasional"
   - examples: array of 2-3 brief quotes or paraphrases from their posts

2. **writingStyle**: Object describing their writing approach:
   - tone: string (e.g., "Professional yet conversational")
   - characteristics: array of 3-5 specific style traits (e.g., "Uses technical terminology", "Often asks questions")
   - voiceDescription: string (2-3 sentences describing their unique voice)

3. **engagementPatterns**: Object analyzing what performs well:
   - topPerformers: array of 2-3 observations about which types of content get most engagement
   - contentStrengths: array of 2-3 strengths in their posting strategy
   - suggestions: array of 2-3 actionable suggestions for improvement

4. **summary**: A compelling 3-4 sentence overall characterization of this user's social media presence

Provide specific evidence and quotes to support your analysis. Start directly with { and end with }`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const cleanedText = cleanJsonResponse(data.content[0].text);
      const result = JSON.parse(cleanedText);

      // Cache the result
      setCachedProfileAnalysis(cacheKey, result);

      res.set(
        "Cache-Control",
        "public, max-age=120, stale-while-revalidate=300",
      );
      res.json({
        ...result,
        cached: false,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error analyzing posts:", error);
      res.status(500).json({
        error: "Failed to analyze posts",
      });
    }
  },
);

/**
 * POST /api/thread-summary
 * Generate thread summary in various formats
 */
router.post(
  "/thread-summary",
  requireCognitoAuth(),
  aiEndpointLimiter,
  async (req, res) => {
    const { posts, format = "haiku" } = req.body;
    const forceRefresh = req.query.forceRefresh === "true";
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Input validation
    if (!posts || !Array.isArray(posts)) {
      return res.status(400).json({ error: "Missing or invalid posts array" });
    }

    if (posts.length === 0) {
      return res.status(400).json({ error: "Posts array cannot be empty" });
    }

    if (posts.length > 500) {
      return res.status(400).json({
        error: "Too many posts",
        details: "Maximum 500 posts per request",
      });
    }

    const validFormats = [
      "haiku",
      "tldr",
      "keypoints",
      "extended",
      "brief",
      "moderate",
      "detailed",
      "comprehensive",
    ];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: "Invalid format",
        details: `Format must be one of: ${validFormats.join(", ")}`,
      });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Server API key not configured" });
    }

    // Truncate and sanitize posts
    const sanitizedPosts = posts.map((post, index) => ({
      text:
        typeof post.text === "string"
          ? post.text.slice(0, 10000)
          : String(post.text || "").slice(0, 10000),
      author: String(post.author || "unknown").slice(0, 200),
      authorHandle: String(post.authorHandle || post.author || "unknown").slice(
        0,
        100,
      ),
      likes: Number(post.likes) || 0,
      replies: Number(post.replies) || 0,
      reposts: Number(post.reposts) || 0,
      uri: String(post.uri || "").slice(0, 500),
      parentUri: post.parentUri ? String(post.parentUri).slice(0, 500) : null,
      depth: Number(post.depth) || 0,
      index,
    }));

    const totalEngagement = sanitizedPosts.reduce(
      (sum, p) => sum + p.likes + p.replies + (p.reposts || 0),
      0,
    );

    // Smart filtering for large threads
    const MAX_CONTEXT_CHARS = 400000;
    const MAX_POSTS_FOR_SUMMARY = 150;

    let postsForSummary = sanitizedPosts;

    if (sanitizedPosts.length > 50) {
      const getEngagement = (p) => p.likes + p.replies + (p.reposts || 0);

      const rootPost =
        sanitizedPosts.find((p) => p.depth === 0) || sanitizedPosts[0];
      const otherPosts = sanitizedPosts.filter((p) => p !== rootPost);

      const engagedPosts = otherPosts.filter((p) => getEngagement(p) > 0);

      let selectedPosts;
      if (engagedPosts.length > MAX_POSTS_FOR_SUMMARY - 1) {
        selectedPosts = engagedPosts
          .sort((a, b) => getEngagement(b) - getEngagement(a))
          .slice(0, MAX_POSTS_FOR_SUMMARY - 1);
      } else if (
        engagedPosts.length < 20 &&
        otherPosts.length > engagedPosts.length
      ) {
        const zeroEngagement = otherPosts
          .filter((p) => getEngagement(p) === 0)
          .slice(0, 50 - engagedPosts.length);
        selectedPosts = [...engagedPosts, ...zeroEngagement];
      } else {
        selectedPosts = engagedPosts;
      }

      postsForSummary = [rootPost, ...selectedPosts];

      let totalChars = 0;
      const finalPosts = [];
      for (const post of postsForSummary) {
        const postChars =
          post.text.length + (post.authorHandle?.length || 0) + 50;
        if (
          totalChars + postChars > MAX_CONTEXT_CHARS &&
          finalPosts.length > 0
        ) {
          break;
        }
        finalPosts.push(post);
        totalChars += postChars;
      }
      postsForSummary = finalPosts;

      console.log(
        `[thread-summary] Filtered posts: ${sanitizedPosts.length} -> ${postsForSummary.length}`,
      );
    }

    // Find high-engagement sub-threads
    const highlightedSubThreads = postsForSummary
      .filter((p) => p.uri && (p.likes >= 10 || p.replies >= 5))
      .sort((a, b) => b.likes + b.replies - (a.likes + a.replies))
      .slice(0, 5)
      .map((p) => ({
        uri: p.uri,
        authorHandle: p.authorHandle,
        snippet: p.text.slice(0, 100) + (p.text.length > 100 ? "..." : ""),
        engagement: p.likes + p.replies,
      }));

    // Check cache
    const cacheKey = generateCacheKey(postsForSummary, format);
    if (!forceRefresh) {
      const cached = getCachedSummary(cacheKey);
      if (cached) {
        res.set(
          "Cache-Control",
          "public, max-age=120, stale-while-revalidate=300",
        );
        return res.json({
          summary: cached.summary,
          format: cached.format,
          metadata: {
            ...cached.metadata,
            cached: true,
            generatedAt: new Date(cached.generatedAt).toISOString(),
          },
        });
      }
    }

    try {
      const postsContext = postsForSummary
        .map((post) => {
          return `<post author="@${post.authorHandle}" likes="${post.likes}" replies="${post.replies}">
${post.text}
</post>`;
        })
        .join("\n\n");

      const authors = [...new Set(postsForSummary.map((p) => p.author))];

      // Build format-specific prompts
      let formatPrompt;
      let maxTokens;

      switch (format) {
        case "haiku":
          formatPrompt = `Write a haiku (5-7-5 syllable structure) that captures the essence of this thread discussion.
The haiku should be poetic and insightful, distilling the main theme or emotional core of the conversation.
Return ONLY the haiku, three lines, no additional text or formatting.`;
          maxTokens = 100;
          break;
        case "tldr":
          formatPrompt = `Write a concise TL;DR summary of this thread conversation in 1-2 sentences (max 280 characters).
Summarize both the original post AND what the replies discuss - capture the conversation, not just the original point.
If there's debate or different viewpoints, mention that. If people agree or add context, note that.
Return ONLY the summary text, no labels or prefixes.`;
          maxTokens = 150;
          break;
        case "keypoints":
          formatPrompt = `Extract 3-5 key points from this thread discussion.
Format as a simple bullet list with each point on its own line, starting with "• ".
Keep each point concise (under 100 characters).
Return ONLY the bullet points, no headers or additional formatting.`;
          maxTokens = 300;
          break;
        case "brief":
          formatPrompt = `Write ONE sentence (max 140 characters) summarizing what this thread is about.
Focus on the main topic and general sentiment of replies.
Be direct and informative - no filler words.
Return ONLY the sentence, no labels or prefixes.`;
          maxTokens = 80;
          break;
        case "moderate":
          formatPrompt = `Write 2-3 sentences summarizing this thread conversation (max 400 characters total).
First sentence: What's the main topic or point.
Second sentence: How did the conversation develop (agreements, debates, new angles).
Third sentence (if notable): Any interesting conclusions or standout points.
Be concise and capture the essence of the discussion.
Return ONLY the summary text, no labels or prefixes.`;
          maxTokens = 200;
          break;
        case "detailed":
          formatPrompt = `Write a detailed summary of this thread (150-250 words).
Structure:
1. Opening: What sparked this conversation (1-2 sentences)
2. Main themes: What topics emerged in the replies (2-3 sentences)
3. Key viewpoints: Different perspectives or arguments made (2-3 sentences)
4. Notable moments: Any replies that got significant engagement or shifted the conversation (1-2 sentences)
5. Closing: Where the conversation landed (1 sentence)

Be informative and help readers understand what happened in this thread without reading every reply.
Return ONLY the summary text, no labels or section headers.`;
          maxTokens = 500;
          break;
        case "comprehensive":
        case "extended": {
          const subThreadContext =
            highlightedSubThreads.length > 0
              ? `\n\nNotable high-engagement replies to consider highlighting:\n${highlightedSubThreads.map((st) => `- @${st.authorHandle} (${st.engagement} engagement): "${st.snippet}"`).join("\n")}`
              : "";

          formatPrompt = `Write a comprehensive analysis of this viral thread (250-400 words).

IMPORTANT: When referencing specific replies, ALWAYS use descriptive references like:
- "@username's point about [topic]"
- "@username argued that..."
- "One user (@username) shared their experience with..."
- "@username's reply about [brief description]"

NEVER use post numbers or indexes like "Post #1" or "Posts #37, #50". Readers can't see those numbers.

Analyze:
1. Original Post and Impact - What sparked this conversation and why it resonated (2-3 sentences)
2. Major Conversation Threads - What sub-topics emerged, referencing specific users who raised them (3-4 sentences)
3. Key Participants and Perspectives - Who added valuable viewpoints, with @mentions and what they contributed (2-3 sentences)
4. Points of Agreement and Disagreement - Where people aligned or clashed, citing specific exchanges (2-3 sentences)
5. How the Conversation Evolved - Did the tone or focus shift over time (2-3 sentences)
6. Most Impactful Contributions - Which replies resonated most and why, with @mentions (2-3 sentences)
7. Overall Takeaway - What would someone miss if they skipped this thread (1-2 sentences)
${subThreadContext}

After the main summary, add a section:

---HIGHLIGHTS---
List the top 3-5 most notable replies in this format:
@handle: "quote snippet" - Brief description of why this was notable

This helps readers find the best parts of the conversation by searching for the quoted text or username.
Return the full analysis followed by the highlights section.`;
          maxTokens = 1000;
          break;
        }
        default:
          formatPrompt = `Write a haiku (5-7-5 syllable structure) that captures the essence of this thread.`;
          maxTokens = 100;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          messages: [
            {
              role: "user",
              content: `<system>
You are a thread summarizer. Analyze the following thread posts and provide a summary in the requested format.

Key rules:
- Reference users by their @handle (e.g., "@username's point about...")
- NEVER use post numbers or indexes (readers can't see them)
- Quote brief snippets when highlighting specific replies
- Focus on substance, not meta-commentary about "the thread" or "users"
</system>

<thread>
${postsContext}
</thread>

<task>
${formatPrompt}
</task>`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      let summaryText = data.content[0].text.trim();

      // Parse highlights from comprehensive/extended summaries
      let parsedHighlights;
      if (format === "comprehensive" || format === "extended") {
        const highlightsMatch = summaryText.match(
          /---HIGHLIGHTS---\s*([\s\S]*?)$/,
        );
        if (highlightsMatch) {
          summaryText = summaryText
            .replace(/---HIGHLIGHTS---[\s\S]*$/, "")
            .trim();

          const highlightLines = highlightsMatch[1].trim().split("\n");
          parsedHighlights = highlightLines
            .map((line) => {
              const match = line.match(/\[(\d+)\]:\s*@(\S+)\s*-\s*(.+)/);
              if (match) {
                const postIndex = parseInt(match[1], 10) - 1;
                const post = sanitizedPosts[postIndex];
                return {
                  uri: post?.uri || "",
                  authorHandle: match[2],
                  snippet: match[3].slice(0, 200),
                  engagement:
                    (post?.likes || 0) +
                    (post?.replies || 0) +
                    (post?.reposts || 0),
                };
              }
              return null;
            })
            .filter((h) => h !== null && h.uri !== "");
        }
      }

      const now = Date.now();
      const result = {
        summary: summaryText,
        format,
        metadata: {
          postCount: sanitizedPosts.length,
          analyzedPostCount: postsForSummary.length,
          authors,
          generatedAt: new Date(now).toISOString(),
          totalEngagement,
          highlightedSubThreads:
            format === "comprehensive" || format === "extended"
              ? parsedHighlights || highlightedSubThreads
              : undefined,
        },
      };

      // Cache the result
      setCachedSummary(cacheKey, {
        summary: summaryText,
        format,
        metadata: result.metadata,
      });

      res.set(
        "Cache-Control",
        "public, max-age=120, stale-while-revalidate=300",
      );
      res.json(result);
    } catch (error) {
      console.error("Error generating thread summary:", error);
      res.status(500).json({
        error: "Failed to generate thread summary",
      });
    }
  },
);

module.exports = router;
