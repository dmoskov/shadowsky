/**
 * Media Processing API Routes
 *
 * Endpoints for image proxying, GIF conversion, and media handling.
 */

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { moderateLimiter } = require("../middleware/rate-limit");
const { largeJsonBody } = require("../middleware/body");
const { validateUrlForSSRF, ssrfSafeFetch } = require("../ip-validator");

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * GET /api/proxy-image
 * Proxy images from Bluesky CDN to avoid CORS issues
 */
router.get("/proxy-image", moderateLimiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  // SSRF Protection
  const ssrfValidation = await validateUrlForSSRF(url);
  if (!ssrfValidation.valid) {
    console.warn(
      `SSRF blocked for proxy-image URL: ${url} - ${ssrfValidation.error}`,
      ssrfValidation.resolvedIP ? `(IP: ${ssrfValidation.resolvedIP})` : "",
    );
    return res.status(403).json({
      error: "Request blocked for security reasons",
    });
  }

  try {
    console.log("Proxying image from:", url);

    const response = await ssrfSafeFetch(url, {
      headers: {
        "User-Agent": "shadowsky-image-proxy/1.0",
        Referer: "https://bsky.app",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Reject early if Content-Length header declares a response larger than the limit
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      // Destroy the response body so the connection is not left hanging
      if (response.body && typeof response.body.destroy === "function") {
        response.body.destroy();
      }
      return res.status(413).json({ error: "Image too large" });
    }

    // Stream the body with a hard size cap (Content-Length can be absent or wrong)
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_IMAGE_SIZE) {
        if (typeof response.body.destroy === "function") {
          response.body.destroy();
        }
        return res.status(413).json({ error: "Image too large" });
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks, totalBytes);
    const contentType = response.headers.get("content-type") || "image/jpeg";

    res.set({
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    });

    res.send(buffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({
      error: "Failed to proxy image",
    });
  }
});

/**
 * POST /api/convert-gif
 * Convert GIF URL to MP4 for better performance
 */
router.post("/convert-gif", largeJsonBody, moderateLimiter, async (req, res) => {
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
      console.log("Processing data URL GIF");
      const base64Data = gifUrl.split(",")[1];
      buffer = Buffer.from(base64Data, "base64");
    } else {
      // SSRF Protection
      const ssrfValidation = await validateUrlForSSRF(gifUrl);
      if (!ssrfValidation.valid) {
        console.warn(
          `SSRF blocked for convert-gif URL: ${gifUrl} - ${ssrfValidation.error}`,
          ssrfValidation.resolvedIP ? `(IP: ${ssrfValidation.resolvedIP})` : "",
        );
        return res.status(403).json({
          error: "Request blocked for security reasons",
        });
      }

      console.log("Fetching GIF from:", gifUrl);
      const response = await ssrfSafeFetch(gifUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch GIF: ${response.statusText}`);
      }

      // Reject early if Content-Length exceeds limit
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
        if (response.body && typeof response.body.destroy === "function") {
          response.body.destroy();
        }
        return res.status(413).json({ error: "GIF too large" });
      }

      // Stream with size cap
      const chunks = [];
      let totalBytes = 0;

      for await (const chunk of response.body) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_IMAGE_SIZE) {
          if (typeof response.body.destroy === "function") {
            response.body.destroy();
          }
          return res.status(413).json({ error: "GIF too large" });
        }
        chunks.push(chunk);
      }

      buffer = Buffer.concat(chunks, totalBytes);
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
    });
  }
});

module.exports = router;
