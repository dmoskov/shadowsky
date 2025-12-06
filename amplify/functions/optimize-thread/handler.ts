/**
 * Optimize Thread Handler
 *
 * Analyzes long-form content and splits it into optimal thread segments
 * for social media posting, maintaining narrative flow and engagement.
 */

import { createAnthropicHandler, truncateText } from '../shared/handler-factory';
import { MODELS } from '../shared/model-config';

interface RequestBody {
  text?: string;
  maxCharsPerPost?: number;
}

export const handler = createAnthropicHandler<RequestBody>({
  name: 'optimize-thread',
  requiredParams: ['text'],
  logMessage: (body) => `Optimizing thread with max ${body.maxCharsPerPost || 300} chars/post`,
  buildPrompt: (body) => {
    const text = body.text!;
    const maxCharsPerPost = body.maxCharsPerPost || 300;
    const truncatedText = truncateText(text, 5000);

    return {
      model: MODELS.SONNET,
      maxTokens: 2000,
      prompt: `Optimize this text for a social media thread with a maximum of ${maxCharsPerPost} characters per post.

Text: "${truncatedText}"

Analyze the content and provide a JSON response with:
{
  "segments": [
    {
      "text": "first post content",
      "number": 1,
      "isStandalone": true/false
    }
  ],
  "summary": "brief summary of what the thread is about",
  "suggestedFormat": "simple" | "brackets" | "thread" | "dots",
  "totalPosts": number
}

Thread format guidelines:
- "simple": Just post numbers (1., 2., 3.)
- "brackets": Bracketed numbers ([1/n], [2/n])
- "thread": Thread emoji format (🧵 1/n)
- "dots": Dot separators (• Post 1)

Rules:
- Each segment must be under ${maxCharsPerPost} characters
- Break at natural points (sentences, paragraphs)
- Maintain narrative flow
- Mark segments as standalone if they make sense independently
- Choose the most appropriate format based on content type

Your response MUST be valid JSON only.`,
    };
  },
  processResponse: (result) => {
    const response = result as { totalPosts?: number; segments?: unknown[] };
    return {
      ...response,
      _meta: {
        segmentCount: response.totalPosts || response.segments?.length || 0,
      },
    };
  },
});
