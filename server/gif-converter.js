const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");

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

app.use(express.json());

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
        "Referer": "https://bsky.app",
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
  console.log(`GIF converter server running on port ${PORT}`);
});
