import {
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
  parseEventBody,
} from "../shared/api-response";

interface RequestBody {
  url?: string;
}

interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractMetaTags(html: string): {
  title: string;
  description: string;
  imageUrl?: string;
} {
  let title = "";
  let description = "";
  let imageUrl: string | undefined;

  // Extract <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract meta tags
  const metaTagRegex =
    /<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["']\s+(?:[^>]*?\s+)?content=["']([^"']*)["'][^>]*>/gi;
  const metaTagRegex2 =
    /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["'][^>]*>/gi;

  let match;

  // First regex pattern (name/property before content)
  while ((match = metaTagRegex.exec(html)) !== null) {
    const name = match[1].toLowerCase();
    const content = decodeHtmlEntities(match[2]);
    processMetaTag(name, content, { title, description, imageUrl }, (result) => {
      title = result.title;
      description = result.description;
      imageUrl = result.imageUrl;
    });
  }

  // Second regex pattern (content before name/property)
  while ((match = metaTagRegex2.exec(html)) !== null) {
    const content = decodeHtmlEntities(match[1]);
    const name = match[2].toLowerCase();
    processMetaTag(name, content, { title, description, imageUrl }, (result) => {
      title = result.title;
      description = result.description;
      imageUrl = result.imageUrl;
    });
  }

  return { title, description, imageUrl };
}

function processMetaTag(
  name: string,
  content: string,
  current: { title: string; description: string; imageUrl?: string },
  update: (result: { title: string; description: string; imageUrl?: string }) => void
): void {
  let { title, description, imageUrl } = current;

  switch (name) {
    case "og:title":
    case "twitter:title":
      if (!title || name === "og:title") {
        title = content;
      }
      break;
    case "og:description":
    case "twitter:description":
    case "description":
      if (!description || name === "og:description") {
        description = content;
      }
      break;
    case "og:image":
    case "twitter:image":
    case "twitter:image:src":
      if (!imageUrl || name === "og:image") {
        imageUrl = content;
      }
      break;
  }

  update({ title, description, imageUrl });
}

function decodeHtmlEntities(text: string): string {
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

function resolveImageUrl(imageUrl: string | undefined, baseUrl: string): string | undefined {
  if (!imageUrl) return undefined;

  try {
    // If already absolute URL, return as-is
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }

    // If protocol-relative, add https
    if (imageUrl.startsWith("//")) {
      return `https:${imageUrl}`;
    }

    // Resolve relative URL
    const base = new URL(baseUrl);
    if (imageUrl.startsWith("/")) {
      return `${base.origin}${imageUrl}`;
    }

    return new URL(imageUrl, baseUrl).href;
  } catch {
    return undefined;
  }
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  // Handle OPTIONS request for CORS preflight
  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  try {
    const body = parseEventBody<RequestBody>(event);
    const { url } = body || {};

    if (!url) {
      return createMissingParameterError("url", event, correlationId);
    }

    if (!isValidUrl(url)) {
      return createInvalidParameterError("url", "Invalid URL format", event, correlationId);
    }

    logInfo("fetch-link-metadata", `Fetching metadata for: ${url}`, correlationId);

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ShadowSky/1.0; +https://shadowsky.io)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logError(
          "fetch-link-metadata",
          `Failed to fetch URL: ${response.status}`,
          correlationId
        );
        return createExternalApiError(
          "URL Fetch",
          `Failed to fetch URL: ${response.status}`,
          event,
          correlationId
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        // Not an HTML page, return minimal metadata
        const result: LinkMetadata = {
          url,
          title: new URL(url).hostname,
          description: "",
        };
        return createSuccessResponse(result, event, { correlationId });
      }

      // Read only the first 100KB to avoid memory issues with large pages
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read response body");
      }

      let html = "";
      const decoder = new TextDecoder();
      const maxBytes = 100 * 1024; // 100KB
      let bytesRead = 0;

      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value?.length || 0;

        // Early exit if we've found all the metadata we need
        if (html.includes("</head>")) {
          break;
        }
      }

      reader.cancel();

      const { title, description, imageUrl } = extractMetaTags(html);
      const resolvedImageUrl = resolveImageUrl(imageUrl, url);

      const result: LinkMetadata = {
        url,
        title: title || new URL(url).hostname,
        description: description || "",
        imageUrl: resolvedImageUrl,
      };

      logInfo("fetch-link-metadata", "Metadata extracted successfully", correlationId, {
        hasTitle: !!title,
        hasDescription: !!description,
        hasImage: !!resolvedImageUrl,
      });

      return createSuccessResponse(result, event, { correlationId });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return createExternalApiError(
          "URL Fetch",
          "Request timed out",
          event,
          correlationId
        );
      }

      throw fetchError;
    }
  } catch (error) {
    logError("fetch-link-metadata", error, correlationId);
    return createInternalError(error, event, correlationId);
  }
};
