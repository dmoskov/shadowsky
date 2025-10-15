const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");

// Load environment variables from parent directory's .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for your Vite dev server and production domains
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "https://main.shadowsky.io",
      "https://shadowsky.io",
      "https://*.shadowsky.io",
    ],
    credentials: true,
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
                  text: "Generate concise alt text for this image that would help someone using a screen reader understand what's shown. Keep it under 125 characters. Focus on the main subject and action.",
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

app.listen(PORT, () => {
  console.log(`ShadowSky API server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - POST /api/convert-gif     : Convert GIF to MP4`);
  console.log(`  - POST /api/generate-alt-text: Generate alt text for images`);
  console.log(`  - GET  /api/proxy-image     : Proxy images to avoid CORS`);
  console.log(
    `\nAPI Configuration:`,
    process.env.ANTHROPIC_API_KEY
      ? `✓ Anthropic API key loaded`
      : `✗ Anthropic API key not found`,
  );
});
