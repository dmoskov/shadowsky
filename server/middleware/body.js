/**
 * JSON body parsers with per-route size limits.
 *
 * The parser used to be a single app-wide `express.json({ limit: "50mb" })`,
 * which let anyone send a 50 MB payload to a text-only AI route. Each route
 * now opts into the smallest limit that fits its payload. Parsers must be
 * attached per route (not via router.use): every router is mounted on the
 * same prefix, so a router-level parser would run for other routers' paths.
 */

const express = require("express");

// Single-post text payloads: composer text, tone, hashtags.
const smallJsonBody = express.json({ limit: "256kb" });

// Bulk text payloads: up to 500 thread posts or 50 profile posts.
const textBatchJsonBody = express.json({ limit: "6mb" });

// One base64 image (Anthropic's max is 5 MB decoded; ~6.7 MB encoded).
const imageJsonBody = express.json({ limit: "8mb" });

// Base64 media uploads and bug reports with screenshots.
const largeJsonBody = express.json({ limit: "50mb" });

module.exports = {
  smallJsonBody,
  textBatchJsonBody,
  imageJsonBody,
  largeJsonBody,
};
