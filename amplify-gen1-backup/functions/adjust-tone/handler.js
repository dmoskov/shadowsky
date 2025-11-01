// Amplify Function for adjusting text tone

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { text, tone } = body;

    if (!text || !tone) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing text or tone" }),
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

    const TONE_DESCRIPTIONS = {
      professional: "formal, clear, and business-appropriate language",
      casual: "relaxed, conversational, and friendly language",
      humorous: "witty, playful, and entertaining language while maintaining the core message",
      informative: "educational, fact-focused, and explanatory language",
      inspirational: "motivating, uplifting, and encouraging language",
    };

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
            content: `Rewrite the following text to have a ${tone} tone. Use ${TONE_DESCRIPTIONS[tone]}. Maintain the original meaning and key information, but adjust the style and word choice. Keep it concise and suitable for a social media post (under 300 characters per segment if it needs to be split).

Original text: "${text}"

Provide only the rewritten text without any explanation or prefixes.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Anthropic API error: ${error}` }),
      };
    }

    const data = await response.json();
    const adjustedText = data.content[0].text.trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        adjustedText,
        originalText: text,
        tone,
      }),
    };
  } catch (error) {
    console.error("Error adjusting tone:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
