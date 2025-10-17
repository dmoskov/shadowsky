// Amplify Function for generating alt text
// This replaces the Express endpoint /api/generate-alt-text

export const handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*", // Will be configured in amplify.yml
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { imageUrl } = body;

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing imageUrl" }),
      };
    }

    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server API key not configured" }),
      };
    }

    let base64Image;
    let mimeType;

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

      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: `Failed to fetch image: ${response.status}`,
          }),
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString("base64");
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
      }
    );

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Anthropic API error: ${error}` }),
      };
    }

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
        error: error.message || "Internal server error",
      }),
    };
  }
};
