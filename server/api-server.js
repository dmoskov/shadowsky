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

// Load environment variables from parent directory's .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

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
  const { posts } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: "Missing or invalid posts array" });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "Server API key not configured" });
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
            content: `You are a social media analyst. Analyze these posts from a single user to provide a qualitative characterization of their content and style.

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

Provide specific evidence and quotes to support your analysis. Start directly with { and end with }`,
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
    console.error("Error analyzing posts:", error);
    res.status(500).json({
      error: error.message,
    });
  }
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
  console.log(
    `  - POST /api/analyze-posts     : Analyze user posts qualitatively`,
  );
  console.log(
    `\nAPI Configuration:`,
    process.env.ANTHROPIC_API_KEY
      ? `✓ Anthropic API key loaded`
      : `✗ Anthropic API key not found`,
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
