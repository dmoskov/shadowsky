/**
 * Utility API Routes
 *
 * Endpoints for link metadata, bug reporting, and other utilities.
 */

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const crypto = require("crypto");
const { moderateLimiter } = require("../middleware/rate-limit");
const { validateUrlForSSRF, ssrfSafeFetch } = require("../ip-validator");
const { decodeHtmlEntities, getClientIp } = require("../utils/helpers");

/**
 * POST /api/fetch-link-metadata
 * Fetch metadata for link previews in composer
 */
router.post("/fetch-link-metadata", moderateLimiter, async (req, res) => {
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

  // SSRF Protection
  const ssrfValidation = await validateUrlForSSRF(url);
  if (!ssrfValidation.valid) {
    console.warn(
      `SSRF blocked for URL: ${url} - ${ssrfValidation.error}`,
      ssrfValidation.resolvedIP ? `(IP: ${ssrfValidation.resolvedIP})` : "",
    );
    return res.status(403).json({
      error: "Request blocked for security reasons",
    });
  }

  console.log("Fetching link metadata for:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await ssrfSafeFetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ShadowSky/1.0; +https://shadowsky.io)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
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

    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
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

/**
 * POST /api/bug-report
 * Submit a bug report with diagnostic information
 */
router.post("/bug-report", moderateLimiter, async (req, res) => {
  const {
    description,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    diagnostics,
    screenshot,
    userHandle,
    submittedAt,
  } = req.body;

  // Validate required fields
  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({
      error: "Bug description is required",
    });
  }

  if (description.length > 5000) {
    return res.status(400).json({
      error: "Description is too long (max 5000 characters)",
    });
  }

  const referenceId = `BUG-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const bugReport = {
    referenceId,
    description: description.trim(),
    stepsToReproduce: stepsToReproduce?.trim() || null,
    expectedBehavior: expectedBehavior?.trim() || null,
    actualBehavior: actualBehavior?.trim() || null,
    diagnostics: diagnostics || null,
    hasScreenshot: !!screenshot,
    userHandle: userHandle || "anonymous",
    submittedAt: submittedAt || new Date().toISOString(),
    clientIp: getClientIp(req),
  };

  console.log(
    `[BUG REPORT] ${referenceId}:`,
    JSON.stringify({
      description:
        bugReport.description.slice(0, 100) +
        (bugReport.description.length > 100 ? "..." : ""),
      userHandle: bugReport.userHandle,
      hasDiagnostics: !!bugReport.diagnostics,
      hasScreenshot: bugReport.hasScreenshot,
      submittedAt: bugReport.submittedAt,
    }),
  );

  // Check if GitHub integration is configured
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_BUG_REPORT_REPO;

  if (githubToken && githubRepo) {
    try {
      const issueTitle = `[Bug Report] ${description.slice(0, 80)}${description.length > 80 ? "..." : ""}`;

      let issueBody = `## Bug Report (${referenceId})\n\n`;
      issueBody += `**Reported by:** ${userHandle}\n`;
      issueBody += `**Submitted at:** ${submittedAt}\n\n`;
      issueBody += `### Description\n${description}\n\n`;

      if (stepsToReproduce) {
        issueBody += `### Steps to Reproduce\n${stepsToReproduce}\n\n`;
      }

      if (expectedBehavior) {
        issueBody += `### Expected Behavior\n${expectedBehavior}\n\n`;
      }

      if (actualBehavior) {
        issueBody += `### Actual Behavior\n${actualBehavior}\n\n`;
      }

      if (diagnostics) {
        issueBody += `### Diagnostic Information\n`;
        issueBody += `- **App Version:** ${diagnostics.appVersion || "N/A"}\n`;
        issueBody += `- **Platform:** ${diagnostics.platform || "N/A"}\n`;
        issueBody += `- **Screen Size:** ${diagnostics.screenSize || "N/A"}\n`;
        issueBody += `- **User Agent:** ${diagnostics.userAgent?.slice(0, 100) || "N/A"}\n`;
        issueBody += `- **Timezone:** ${diagnostics.timezone || "N/A"}\n`;

        if (diagnostics.errorStats) {
          issueBody += `\n#### Error Stats (Last Hour)\n`;
          issueBody += `- Total Errors: ${diagnostics.errorStats.totalErrors}\n`;
          issueBody += `- Last Hour: ${diagnostics.errorStats.lastHour}\n`;
          if (diagnostics.errorStats.mostFrequentType) {
            issueBody += `- Most Frequent: ${diagnostics.errorStats.mostFrequentType}\n`;
          }
        }

        if (diagnostics.recentErrors && diagnostics.recentErrors.length > 0) {
          issueBody += `\n#### Recent Errors\n`;
          issueBody += "```\n";
          diagnostics.recentErrors.slice(0, 5).forEach((err, i) => {
            issueBody += `${i + 1}. [${err.category}] ${err.type}: ${err.message?.slice(0, 100)}\n`;
          });
          issueBody += "```\n";
        }
      }

      if (screenshot) {
        issueBody += `\n### Screenshot\nA screenshot was attached to this report (stored separately due to size).\n`;
      }

      const [owner, repo] = githubRepo.split("/");
      const githubResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "ShadowSky-BugReporter/1.0",
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ["bug", "user-reported"],
          }),
        },
      );

      if (githubResponse.ok) {
        const issueData = await githubResponse.json();
        console.log(
          `[BUG REPORT] Created GitHub issue #${issueData.number} for ${referenceId}`,
        );

        return res.status(201).json({
          success: true,
          referenceId,
          message: "Bug report submitted successfully",
          issueUrl: issueData.html_url,
        });
      } else {
        const errorText = await githubResponse.text();
        console.error(
          `[BUG REPORT] Failed to create GitHub issue for ${referenceId}:`,
          errorText,
        );
      }
    } catch (githubError) {
      console.error(
        `[BUG REPORT] GitHub API error for ${referenceId}:`,
        githubError,
      );
    }
  }

  // Return success even without GitHub (report is logged)
  res.status(201).json({
    success: true,
    referenceId,
    message: "Bug report submitted successfully",
  });
});

module.exports = router;
