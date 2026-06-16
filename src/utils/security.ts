/**
 * Security utilities for sanitizing user-generated content and validating URLs
 */

import DOMPurify from "dompurify";

/**
 * List of allowed URL protocols for external links
 */
const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:"];

/**
 * Allowlist of trusted domains for embedded media
 */
export const TRUSTED_MEDIA_DOMAINS = [
  // Bluesky CDN
  "cdn.bsky.app",
  "cdn.bsky.social",
  "av.bsky.app",
  "video.bsky.app",
  // Image proxy (if used)
  "images.weserv.nl",
  "imageproxy.bsky.app",
  // Common video/media platforms that might be embedded
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "giphy.com",
  "media.giphy.com",
  // GIF providers + Bluesky GIF CDN proxies
  "tenor.com",
  "media.tenor.com",
  "t.gifs.bsky.app",
  "static.klipy.com",
  "k.gifs.bsky.app",
];

/**
 * Validates a URL to ensure it uses a safe protocol.
 * Blocks javascript:, data:, vbscript:, and other dangerous protocols.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    // Try to parse as absolute URL first
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // If it fails, check if it's a relative URL (starts with /)
    // Relative URLs are safe as they stay on the same origin
    if (url.startsWith("/") && !url.startsWith("//")) {
      return true;
    }

    // Check for dangerous protocol patterns even in malformed URLs
    const lowerUrl = url.toLowerCase().trim();
    const dangerousPatterns = [
      "javascript:",
      "vbscript:",
      "data:",
      "file:",
      "about:",
      "blob:",
    ];

    for (const pattern of dangerousPatterns) {
      if (lowerUrl.startsWith(pattern)) {
        return false;
      }
    }

    // Reject URLs that don't parse and aren't relative
    return false;
  }
}

/**
 * Sanitizes a URL by validating it and returning a safe fallback if invalid.
 *
 * @param url - The URL to sanitize
 * @param fallback - Optional fallback URL (defaults to "#")
 * @returns The original URL if safe, or the fallback
 */
export function sanitizeUrl(url: string, fallback: string = "#"): string {
  if (isValidUrl(url)) {
    return url;
  }
  return fallback;
}

/**
 * Validates if a URL is from a trusted media domain.
 *
 * @param url - The URL to validate
 * @returns true if the URL is from a trusted domain
 */
export function isTrustedMediaUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Must be https or http
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return false;
    }

    // Check against trusted domains
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_MEDIA_DOMAINS.some((domain) => {
      // Match exact domain or subdomains
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

/**
 * Sanitizes HTML content using DOMPurify.
 * Removes all HTML tags and attributes, keeping only text content.
 *
 * @param html - The HTML string to sanitize
 * @returns Plain text content
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitizes HTML content while allowing safe formatting tags.
 * Useful for rich text content that needs basic formatting.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML with safe tags
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target", "rel"],
    // Force all links to have safe attributes
    FORCE_BODY: true,
  });
}

/**
 * Validates and sanitizes external link attributes.
 * Returns safe attributes for anchor tags.
 *
 * @param url - The URL to validate
 * @returns Object with safe link attributes or null if URL is invalid
 */
export function getSafeLinkAttributes(url: string): {
  href: string;
  target: string;
  rel: string;
} | null {
  if (!isValidUrl(url)) {
    return null;
  }

  // For relative URLs, don't open in new tab
  if (url.startsWith("/") && !url.startsWith("//")) {
    return {
      href: url,
      target: "_self",
      rel: "",
    };
  }

  // For external URLs, always open in new tab with security attributes
  return {
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

/**
 * Extracts the domain from a URL for display purposes.
 *
 * @param url - The URL to extract domain from
 * @returns The domain name or empty string if invalid
 */
export function extractDomain(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

/**
 * Validates user-generated text content for display.
 * Escapes HTML entities to prevent XSS when inserting into DOM.
 *
 * Note: React automatically escapes text content, so this is mainly
 * for cases where dangerouslySetInnerHTML might be used.
 *
 * @param text - The text to escape
 * @returns Escaped text safe for HTML display
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}
