/**
 * Suggest Hashtags Handler
 *
 * Analyzes social media post content and suggests relevant hashtags,
 * including relevance scores and trending indicators.
 */

import { createAnthropicHandler, truncateText } from '../shared/handler-factory';
import { MODELS } from '../shared/model-config';
import { SuggestHashtagsResponseSchema } from '../shared/schemas';

interface RequestBody {
  text?: string;
  existingTags?: string[];
}

export const handler = createAnthropicHandler<RequestBody>({
  name: 'suggest-hashtags',
  requiredParams: ['text'],
  logMessage: () => 'Generating hashtag suggestions',
  buildPrompt: (body) => {
    const text = body.text!;
    const existingTags = body.existingTags || [];
    const truncatedText = truncateText(text, 1000);

    const existingTagsText =
      existingTags.length > 0
        ? `\n\nExisting tags to avoid: ${existingTags.join(', ')}`
        : '';

    return {
      model: MODELS.SONNET,
      maxTokens: 1000,
      prompt: `Suggest relevant hashtags for this social media post.

Post: "${truncatedText}"${existingTagsText}

Provide a JSON response with:
{
  "hashtags": [
    {
      "tag": "hashtag name without #",
      "relevance": 0.0 to 1.0 score,
      "isTrending": true/false
    }
  ],
  "category": "main category of the post (e.g., Technology, Sports, Entertainment)"
}

Guidelines:
- Suggest 3-8 relevant hashtags
- Order by relevance (most relevant first)
- Mix of specific and general tags
- Consider actual trending topics when possible
- Don't duplicate existing tags
- Use proper capitalization (e.g., "JavaScript" not "javascript")

Your response MUST be valid JSON only.`,
    };
  },
  processResponse: (result, body) => {
    const response = result as { hashtags?: Array<{ tag: string }> };
    return {
      ...response,
      _meta: {
        suggestedCount: response.hashtags?.length || 0,
      },
    };
  },
  responseSchema: SuggestHashtagsResponseSchema,
});
