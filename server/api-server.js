const express = require("express");
const http = require("http");
const cors = require("cors");
const fetch = require("node-fetch");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { WebSocketNotificationServer } = require("./websocket-server");
const pushSubscriptions = require("./push-subscriptions");
const pushNotificationService = require("./push-notification-service");

// Load environment variables from parent directory's .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Initialize Web Push with VAPID keys
const pushEnabled = pushSubscriptions.initWebPush();

const app = express();
const PORT = process.env.PORT || 3002;
const WS_PORT = process.env.WS_PORT || 3001;

// Enable CORS for your Vite dev server and production domains
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "https://main.shadowsky.io",
        "https://shadowsky.io",
        "https://www.shadowsky.io",
      ];

      // Allow any subdomain of shadowsky.io
      if (
        origin.match(/^https?:\/\/.*\.shadowsky\.io$/) ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  }),
);

// Increase JSON payload size limit for base64-encoded images
app.use(express.json({ limit: "50mb" }));

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // XSS protection (legacy but still useful for older browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Health check endpoint for load balancer
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Generate alt text for an image URL
app.post("/api/generate-alt-text", async (req, res) => {
  const { imageUrl } = req.body;

  // Use server-side API key from environment variable
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
      // Extract mime type and base64 data from data URL
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
        // Convert Vite proxy path to actual CDN URL
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
        // For any other relative URLs, assume they're from the frontend origin
        absoluteUrl = `http://localhost:5174${imageUrl}`;
      }

      console.log("Fetching image from:", absoluteUrl);
      // Fetch the image
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
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 300,
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
                  text: "Generate alt text for this image that would help someone using a screen reader understand what's shown. Keep it concise (most descriptions should be brief), but you can use up to 500 characters when needed for complex images. Focus on the main subject and action.",
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
    const altText = data.content[0].text;

    res.json({ altText });
  } catch (error) {
    console.error("Error generating alt text:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Endpoint to proxy images from Bluesky CDN for alt text generation
app.get("/api/proxy-image", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    console.log("Proxying image from:", url);

    // Fetch the image from the Bluesky CDN
    const response = await fetch(url, {
      headers: {
        "User-Agent": "shadowsky-image-proxy/1.0",
        Referer: "https://bsky.app",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Send the image back with proper CORS headers
    res.set({
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      "Access-Control-Allow-Origin": "*", // Already handled by CORS middleware but explicit for clarity
    });

    res.send(buffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({
      error: "Failed to proxy image",
      details: error.message,
    });
  }
});

// Endpoint to convert GIF URL to MP4
app.post("/api/convert-gif", async (req, res) => {
  const { gifUrl } = req.body;

  if (!gifUrl) {
    return res.status(400).json({ error: "GIF URL is required" });
  }

  const tempDir = os.tmpdir();
  const tempId = crypto.randomBytes(16).toString("hex");
  const inputPath = path.join(tempDir, `${tempId}.gif`);
  const outputPath = path.join(tempDir, `${tempId}.mp4`);

  try {
    let buffer;

    // Check if it's a data URL or regular URL
    if (gifUrl.startsWith("data:")) {
      // Handle data URL
      console.log("Processing data URL GIF");
      const base64Data = gifUrl.split(",")[1];
      buffer = Buffer.from(base64Data, "base64");
    } else {
      // Fetch the GIF from the URL
      console.log("Fetching GIF from:", gifUrl);
      const response = await fetch(gifUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch GIF: ${response.statusText}`);
      }

      buffer = await response.buffer();
    }

    await fs.writeFile(inputPath, buffer);

    console.log("Converting GIF to MP4...");

    // Convert GIF to MP4 using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-movflags",
          "faststart",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
        ])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .run();
    });

    // Read the converted MP4
    const mp4Buffer = await fs.readFile(outputPath);

    // Clean up temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    // Send the MP4 back as a response
    res.set({
      "Content-Type": "video/mp4",
      "Content-Length": mp4Buffer.length,
    });

    res.send(mp4Buffer);
  } catch (error) {
    console.error("Conversion error:", error);

    // Clean up temp files on error
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    res.status(500).json({
      error: "Failed to convert GIF",
      details: error.message,
    });
  }
});

// Helper function to clean JSON responses (remove markdown code fences)
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Writing feedback endpoint
app.post("/api/writing-feedback", async (req, res) => {
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
        model: "claude-sonnet-4-5-20250929",
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
      error: error.message,
    });
  }
});

// Style analysis endpoint
app.post("/api/style-analysis", async (req, res) => {
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
    // Build the historical posts context
    const historicalContext = historicalPosts
      .slice(0, 20) // Limit to 20 most recent posts
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
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const cleanedText = cleanJsonResponse(data.content[0].text);
    const result = JSON.parse(cleanedText);

    res.json(result);
  } catch (error) {
    console.error("Error analyzing writing style:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Adjust tone endpoint
app.post("/api/adjust-tone", async (req, res) => {
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
        model: "claude-sonnet-4-5-20250929",
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
      error: error.message,
    });
  }
});

// Optimize thread endpoint
app.post("/api/optimize-thread", async (req, res) => {
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
        model: "claude-sonnet-4-5-20250929",
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
      error: error.message,
    });
  }
});

// Suggest hashtags endpoint
app.post("/api/suggest-hashtags", async (req, res) => {
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
        model: "claude-sonnet-4-5-20250929",
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
      error: error.message,
    });
  }
});

// Analyze user posts endpoint
app.post("/api/analyze-posts", async (req, res) => {
  const { posts, analysisType = "sonnet" } = req.body;
  const forceRefresh = req.query.forceRefresh === "true";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: "Missing or invalid posts array" });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "Server API key not configured" });
  }

  // Check cache first (unless force refresh)
  const cacheKey = generateProfileCacheKey(posts, analysisType);
  if (!forceRefresh) {
    const cached = getCachedProfileAnalysis(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
        generatedAt: new Date(cached.generatedAt).toISOString(),
      });
    }
  }

  try {
    // Take a sample of posts if there are too many
    const samplePosts = posts.slice(0, 50);

    // Build the posts context with engagement metrics
    const postsContext = samplePosts
      .map((post, i) => {
        const engagement = `Likes: ${post.likes}, Reposts: ${post.reposts}, Replies: ${post.replies}`;
        return `Post ${i + 1} (${engagement}):\n"${post.text}"\nDate: ${post.createdAt}`;
      })
      .join("\n\n");

    // Choose prompt and token limit based on analysis type
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
        model: "claude-sonnet-4-5-20250929",
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

    res.json({
      ...result,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error analyzing posts:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// =============================================================================
// Thread Summary Cache (10-minute TTL)
// =============================================================================
const threadSummaryCache = new Map();
const THREAD_SUMMARY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

function generateCacheKey(posts, format) {
  // Create a stable cache key from posts content and format
  const postsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(posts.map((p) => p.text).sort()))
    .digest("hex")
    .slice(0, 16);
  return `${format}:${postsHash}`;
}

function getCachedSummary(cacheKey) {
  const cached = threadSummaryCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < THREAD_SUMMARY_CACHE_TTL) {
    return cached;
  }
  // Clean up expired entry
  if (cached) {
    threadSummaryCache.delete(cacheKey);
  }
  return null;
}

function setCachedSummary(cacheKey, result) {
  threadSummaryCache.set(cacheKey, {
    ...result,
    generatedAt: Date.now(),
  });
}

// Periodic cache cleanup (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of threadSummaryCache.entries()) {
      if (now - value.generatedAt >= THREAD_SUMMARY_CACHE_TTL) {
        threadSummaryCache.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

// =============================================================================
// Profile Analysis Cache (48-hour TTL)
// =============================================================================
const profileAnalysisCache = new Map();
const PROFILE_ANALYSIS_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

function generateProfileCacheKey(posts, analysisType) {
  // Create a stable cache key from posts content and analysis type
  const postsHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(posts.map((p) => p.text).sort()))
    .digest("hex")
    .slice(0, 16);
  return `profile:${analysisType}:${postsHash}`;
}

function getCachedProfileAnalysis(cacheKey) {
  const cached = profileAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < PROFILE_ANALYSIS_CACHE_TTL) {
    return cached;
  }
  // Clean up expired entry
  if (cached) {
    profileAnalysisCache.delete(cacheKey);
  }
  return null;
}

function setCachedProfileAnalysis(cacheKey, result) {
  profileAnalysisCache.set(cacheKey, {
    ...result,
    generatedAt: Date.now(),
  });
}

// Periodic cache cleanup for profile analysis (every hour)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of profileAnalysisCache.entries()) {
      if (now - value.generatedAt >= PROFILE_ANALYSIS_CACHE_TTL) {
        profileAnalysisCache.delete(key);
      }
    }
  },
  60 * 60 * 1000,
);

// Fetch link metadata endpoint (for link previews in composer)
app.post("/api/fetch-link-metadata", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Validate URL
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Invalid URL format" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  console.log("Fetching link metadata for:", url);

  try {
    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ShadowSky/1.0; +https://shadowsky.io)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("Failed to fetch URL:", response.status);
      return res.status(500).json({
        error: `Failed to fetch URL: ${response.status}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      // Not an HTML page, return minimal metadata
      return res.json({
        url,
        title: new URL(url).hostname,
        description: "",
      });
    }

    // Read the HTML content (limit to first 100KB)
    const html = await response.text();
    const limitedHtml = html.slice(0, 100 * 1024);

    // Extract meta tags
    let title = "";
    let description = "";
    let imageUrl = null;

    // Extract <title> tag
    const titleMatch = limitedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].trim());
    }

    // Extract meta tags with both attribute orders
    const metaRegex1 =
      /<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["']\s+(?:[^>]*?\s+)?content=["']([^"']*)["'][^>]*>/gi;
    const metaRegex2 =
      /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["'][^>]*>/gi;

    let match;
    while ((match = metaRegex1.exec(limitedHtml)) !== null) {
      processMetaTag(match[1].toLowerCase(), decodeHtmlEntities(match[2]));
    }
    while ((match = metaRegex2.exec(limitedHtml)) !== null) {
      processMetaTag(match[2].toLowerCase(), decodeHtmlEntities(match[1]));
    }

    function processMetaTag(name, content) {
      switch (name) {
        case "og:title":
        case "twitter:title":
          if (!title || name === "og:title") title = content;
          break;
        case "og:description":
        case "twitter:description":
        case "description":
          if (!description || name === "og:description") description = content;
          break;
        case "og:image":
        case "twitter:image":
        case "twitter:image:src":
          if (!imageUrl || name === "og:image") imageUrl = content;
          break;
      }
    }

    // Resolve relative image URLs
    if (imageUrl) {
      try {
        if (imageUrl.startsWith("//")) {
          imageUrl = `https:${imageUrl}`;
        } else if (
          !imageUrl.startsWith("http://") &&
          !imageUrl.startsWith("https://")
        ) {
          const base = new URL(url);
          if (imageUrl.startsWith("/")) {
            imageUrl = `${base.origin}${imageUrl}`;
          } else {
            imageUrl = new URL(imageUrl, url).href;
          }
        }
      } catch {
        imageUrl = null;
      }
    }

    console.log("Link metadata extracted:", {
      title: title.slice(0, 50),
      hasDescription: !!description,
      hasImage: !!imageUrl,
    });

    res.json({
      url,
      title: title || new URL(url).hostname,
      description: description || "",
      imageUrl,
    });
  } catch (error) {
    console.error("Error fetching link metadata:", error);

    if (error.name === "AbortError") {
      return res.status(500).json({ error: "Request timed out" });
    }

    res.status(500).json({
      error: error.message || "Failed to fetch link metadata",
    });
  }
});

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

// Thread summary endpoint
app.post("/api/thread-summary", async (req, res) => {
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

  // Maximum 500 posts per request
  if (posts.length > 500) {
    return res.status(400).json({
      error: "Too many posts",
      details: "Maximum 500 posts per request",
    });
  }

  // Validate format
  const validFormats = ["haiku", "tldr", "keypoints"];
  if (!validFormats.includes(format)) {
    return res.status(400).json({
      error: "Invalid format",
      details: `Format must be one of: ${validFormats.join(", ")}`,
    });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "Server API key not configured" });
  }

  // Truncate individual post texts to 10,000 characters
  const sanitizedPosts = posts.map((post) => ({
    text:
      typeof post.text === "string"
        ? post.text.slice(0, 10000)
        : String(post.text || "").slice(0, 10000),
    author: String(post.author || "unknown").slice(0, 200),
    likes: Number(post.likes) || 0,
    replies: Number(post.replies) || 0,
  }));

  // Check cache (unless forceRefresh is true)
  const cacheKey = generateCacheKey(sanitizedPosts, format);
  if (!forceRefresh) {
    const cached = getCachedSummary(cacheKey);
    if (cached) {
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
    // Build the posts context with author and engagement info
    const postsContext = sanitizedPosts
      .map((post, i) => {
        return `<post index="${i + 1}" author="${post.author}" likes="${post.likes}" replies="${post.replies}">
${post.text}
</post>`;
      })
      .join("\n\n");

    // Get unique authors
    const authors = [...new Set(sanitizedPosts.map((p) => p.author))];

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: `<system>
You are a thread summarizer. Analyze the following thread posts and provide a summary in the requested format.
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
    const summary = data.content[0].text.trim();

    const now = Date.now();
    const result = {
      summary,
      format,
      metadata: {
        postCount: sanitizedPosts.length,
        authors,
        generatedAt: new Date(now).toISOString(),
      },
    };

    // Cache the result
    setCachedSummary(cacheKey, {
      summary,
      format,
      metadata: result.metadata,
    });

    res.json(result);
  } catch (error) {
    console.error("Error generating thread summary:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// =============================================================================
// Push Notification Subscription Endpoints
// =============================================================================

/**
 * Helper to get client IP address
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    "unknown"
  );
}

/**
 * Helper to extract user DID from Authorization header
 * Supports: Bearer <jwt> or DID:<did>
 */
function extractUserDid(req) {
  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }

  // Support DID directly in header (e.g., "DID:did:plc:...")
  if (auth.startsWith("DID:")) {
    return auth.slice(4);
  }

  // Support Bearer token (would need JWT verification in production)
  // For now, client can pass DID in x-user-did header as fallback
  return req.headers["x-user-did"] || null;
}

/**
 * POST /api/push-subscription
 *
 * Register a new push subscription for the authenticated user.
 *
 * Request body:
 * {
 *   endpoint: string,
 *   keys: { p256dh: string, auth: string },
 *   expirationTime?: number | null,
 *   userAgent?: string,
 *   createdAt?: number
 * }
 *
 * Response:
 * {
 *   subscriptionId: string
 * }
 */
app.post("/api/push-subscription", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  const subscription = req.body;
  const userDid = extractUserDid(req);
  const clientIp = getClientIp(req);

  try {
    const result = await pushSubscriptions.createSubscription(
      subscription,
      userDid,
      clientIp,
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        details: result.details,
      });
    }

    res.status(201).json({
      subscriptionId: result.subscriptionId,
    });
  } catch (error) {
    console.error("Error creating push subscription:", error);
    res.status(500).json({
      error: "Failed to create push subscription",
    });
  }
});

/**
 * DELETE /api/push-subscription/:subscriptionId
 *
 * Delete a push subscription.
 */
app.delete("/api/push-subscription/:subscriptionId", async (req, res) => {
  const { subscriptionId } = req.params;
  const userDid = extractUserDid(req);

  try {
    const result = await pushSubscriptions.deleteSubscription(
      subscriptionId,
      userDid,
    );

    if (!result.success) {
      return res.status(403).json({
        error: result.error,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting push subscription:", error);
    res.status(500).json({
      error: "Failed to delete push subscription",
    });
  }
});

/**
 * GET /api/push-subscriptions
 *
 * Get all push subscriptions for the authenticated user.
 */
app.get("/api/push-subscriptions", async (req, res) => {
  const userDid = extractUserDid(req);

  if (!userDid) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const subscriptions =
      await pushSubscriptions.getSubscriptionsForUser(userDid);
    res.json({ subscriptions });
  } catch (error) {
    console.error("Error fetching push subscriptions:", error);
    res.status(500).json({
      error: "Failed to fetch push subscriptions",
    });
  }
});

/**
 * POST /api/push-notification/send
 *
 * Send a push notification to a user (internal/admin endpoint).
 * In production, this should be protected with proper authentication.
 *
 * Request body:
 * {
 *   userDid: string,
 *   notification: {
 *     type: 'notification' | 'message' | 'system',
 *     title: string,
 *     body: string,
 *     icon?: string,
 *     badge?: string,
 *     data?: object
 *   }
 * }
 */
app.post("/api/push-notification/send", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  const { userDid, notification } = req.body;

  if (!userDid || !notification) {
    return res.status(400).json({
      error: "userDid and notification are required",
    });
  }

  try {
    const result = await pushSubscriptions.sendPushNotification(
      userDid,
      notification,
    );

    if (!result.success) {
      return res.status(404).json({
        error: result.error,
      });
    }

    res.json({
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({
      error: "Failed to send push notification",
    });
  }
});

/**
 * GET /api/push/vapid-public-key
 *
 * Get the VAPID public key for client subscription.
 * This allows the frontend to retrieve the key dynamically.
 */
app.get("/api/push/vapid-public-key", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(503).json({
      error: "Push notifications are not configured",
    });
  }

  res.json({
    publicKey,
  });
});

/**
 * POST /api/push-notification/batch
 *
 * Send batch push notifications to a user.
 * Useful for testing or sending multiple notifications efficiently.
 *
 * Request body:
 * {
 *   userDid: string,
 *   notifications: Array<{
 *     reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote',
 *     author?: { displayName?: string, handle: string, did: string },
 *     uri?: string,
 *     record?: { text?: string }
 *   }>
 * }
 */
app.post("/api/push-notification/batch", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  const { userDid, notifications } = req.body;

  if (!userDid || !notifications || !Array.isArray(notifications)) {
    return res.status(400).json({
      error: "userDid and notifications array are required",
    });
  }

  try {
    const result = await pushNotificationService.handleNotifications(
      userDid,
      notifications,
    );
    res.json(result);
  } catch (error) {
    console.error("Error sending batch notifications:", error);
    res.status(500).json({
      error: "Failed to send batch notifications",
    });
  }
});

/**
 * POST /api/push-notification/dm
 *
 * Send a DM notification to a user.
 *
 * Request body:
 * {
 *   userDid: string,
 *   conversation: {
 *     id: string,
 *     senderName?: string,
 *     senderDid: string,
 *     lastMessage?: string
 *   }
 * }
 */
app.post("/api/push-notification/dm", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  const { userDid, conversation } = req.body;

  if (!userDid || !conversation || !conversation.id) {
    return res.status(400).json({
      error: "userDid and conversation with id are required",
    });
  }

  try {
    const result = await pushNotificationService.sendDMNotification(
      userDid,
      conversation,
    );

    if (!result.success && result.reason === "user_active") {
      return res.status(200).json({
        sent: 0,
        skipped: true,
        reason: "User has active WebSocket connection",
      });
    }

    if (!result.success) {
      return res.status(404).json({
        error: result.error || "No subscriptions found for user",
      });
    }

    res.json({
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Error sending DM notification:", error);
    res.status(500).json({
      error: "Failed to send DM notification",
    });
  }
});

/**
 * POST /api/push-notification/system
 *
 * Send a system notification to a user (announcements, etc).
 *
 * Request body:
 * {
 *   userDid: string,
 *   title: string,
 *   body: string,
 *   data?: { url?: string, ... }
 * }
 */
app.post("/api/push-notification/system", async (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      error: "Push notifications are not configured on this server",
    });
  }

  const { userDid, title, body, data } = req.body;

  if (!userDid || !title || !body) {
    return res.status(400).json({
      error: "userDid, title, and body are required",
    });
  }

  try {
    const result = await pushNotificationService.sendSystemNotification(
      userDid,
      title,
      body,
      data || {},
    );

    if (!result.success) {
      return res.status(404).json({
        error: result.error || "No subscriptions found for user",
      });
    }

    res.json({
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Error sending system notification:", error);
    res.status(500).json({
      error: "Failed to send system notification",
    });
  }
});

/**
 * GET /api/push-notification/stats
 *
 * Get push notification service statistics.
 */
app.get("/api/push-notification/stats", (req, res) => {
  const stats = pushNotificationService.getStats();
  res.json(stats);
});

// Create HTTP server for Express app
const httpServer = http.createServer(app);

// Start HTTP server for API
httpServer.listen(PORT, () => {
  console.log(`ShadowSky API server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - POST /api/convert-gif       : Convert GIF to MP4`);
  console.log(`  - POST /api/generate-alt-text : Generate alt text for images`);
  console.log(`  - GET  /api/proxy-image       : Proxy images to avoid CORS`);
  console.log(`  - POST /api/writing-feedback  : Get writing feedback`);
  console.log(`  - POST /api/style-analysis    : Analyze writing style`);
  console.log(`  - POST /api/adjust-tone       : Adjust post tone`);
  console.log(`  - POST /api/optimize-thread   : Optimize thread structure`);
  console.log(`  - POST /api/suggest-hashtags  : Suggest hashtags`);
  console.log(`  - POST /api/fetch-link-metadata: Fetch link preview metadata`);
  console.log(
    `  - POST /api/analyze-posts     : Analyze user posts qualitatively`,
  );
  console.log(
    `  - POST /api/thread-summary    : Generate thread summary (haiku/tldr/keypoints)`,
  );
  console.log(`  - POST /api/push-subscription : Register push subscription`);
  console.log(
    `  - DELETE /api/push-subscription/:id : Remove push subscription`,
  );
  console.log(`  - GET  /api/push-subscriptions : List user subscriptions`);
  console.log(`  - POST /api/push-notification/send : Send push notification`);
  console.log(
    `  - POST /api/push-notification/batch : Batch send notifications`,
  );
  console.log(`  - POST /api/push-notification/dm : Send DM notification`);
  console.log(
    `  - POST /api/push-notification/system : Send system notification`,
  );
  console.log(`  - GET  /api/push-notification/stats : Push service stats`);
  console.log(`  - GET  /api/push/vapid-public-key : Get VAPID public key`);
  console.log(
    `\nAPI Configuration:`,
    process.env.ANTHROPIC_API_KEY
      ? `✓ Anthropic API key loaded`
      : `✗ Anthropic API key not found`,
  );
  console.log(
    `Push Notifications:`,
    pushEnabled
      ? `✓ VAPID keys configured`
      : `✗ VAPID keys not found (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)`,
  );
});

// Create separate HTTP server for WebSocket
const wsHttpServer = http.createServer();

// Initialize WebSocket server
const wsServer = new WebSocketNotificationServer(wsHttpServer, {
  heartbeatInterval: 30000,
  pollInterval: 15000,
  debug: true,
});

// Start WebSocket server
wsHttpServer.listen(WS_PORT, () => {
  console.log(`\n🔌 WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log(`   - Heartbeat interval: 30s`);
  console.log(`   - Notification polling: 15s`);
  console.log(`   - Authentication: JWT via query parameter`);
  console.log(
    `\nTo connect from frontend, set in .env: VITE_WS_URL=ws://localhost:${WS_PORT}`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\nSIGTERM received, shutting down gracefully...");
  wsServer.close();
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
  wsHttpServer.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received, shutting down gracefully...");
  wsServer.close();
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
  wsHttpServer.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});
