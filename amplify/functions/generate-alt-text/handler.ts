/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on authentication errors (401, 403)
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Don't retry on client errors (400) except rate limits (429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request for CORS
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { imageUrl } = body;

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing imageUrl" }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server API key not configured" }),
      };
    }

    let base64Image: string;
    let mimeType: string;

    // Handle data URLs (base64 encoded images)
    if (imageUrl.startsWith("data:")) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid data URL format" }),
        };
      }
      mimeType = matches[1];
      base64Image = matches[2];
    } else {
      // For HTTP URLs, fetch the image
      let absoluteUrl = imageUrl;

      // Convert relative URLs to absolute
      if (imageUrl.startsWith("/bsky-cdn/")) {
        absoluteUrl = imageUrl.replace("/bsky-cdn/", "https://cdn.bsky.app/");
      } else if (imageUrl.startsWith("/bsky-video/")) {
        absoluteUrl = imageUrl.replace(
          "/bsky-video/",
          "https://video.bsky.app/"
        );
      } else if (imageUrl.startsWith("/bsky-video-cdn/")) {
        absoluteUrl = imageUrl.replace(
          "/bsky-video-cdn/",
          "https://video.cdn.bsky.app/"
        );
      }

      // Fetch image with retry
      const response = await retryWithBackoff(async () => {
        const res = await fetch(absoluteUrl);
        if (!res.ok) {
          const error: any = new Error(`Failed to fetch image: ${res.status}`);
          error.status = res.status;
          throw error;
        }
        return res;
      });

      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString("base64");
      mimeType = response.headers.get("content-type") || "image/jpeg";
    }

    // Call Anthropic API with retry
    const anthropicResponse = await retryWithBackoff(async () => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      });

      if (!res.ok) {
        const error: any = new Error(`Anthropic API error: ${res.status}`);
        error.status = res.status;
        error.response = res;
        throw error;
      }

      return res;
    });

    const data = await anthropicResponse.json();
    const altText = data.content[0].text;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ altText }),
    };
  } catch (error) {
    console.error("Error generating alt text:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
