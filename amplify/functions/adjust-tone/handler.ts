/**
 * Adjust Tone Handler
 *
 * Rewrites social media posts with a different tone while preserving
 * the core message, hashtags, mentions, and links.
 */

import { createAnthropicHandler, truncateText } from '../shared/handler-factory';
import { MODELS } from '../shared/model-config';

interface RequestBody {
  text?: string;
  tone?: string;
}

const toneDescriptions: Record<string, string> = {
  professional: 'formal, clear, and business-appropriate language',
  casual: 'relaxed, conversational, and friendly language',
  humorous: 'witty, playful, and entertaining language while maintaining the core message',
  informative: 'educational, fact-focused, and explanatory language',
  inspirational: 'motivating, uplifting, and encouraging language',
};

export const handler = createAnthropicHandler<RequestBody>({
  name: 'adjust-tone',
  requiredParams: ['text', 'tone'],
  logMessage: (body) => `Adjusting tone to: ${body.tone}`,
  buildPrompt: (body) => {
    const text = body.text!;
    const tone = body.tone!;
    const truncatedText = truncateText(text, 2000);
    const toneDescription = toneDescriptions[tone] || tone;

    return {
      model: MODELS.SONNET,
      maxTokens: 1000,
      prompt: `Adjust the tone of this social media post to be ${toneDescription}.

Original post: "${truncatedText}"

Provide a JSON response with:
{
  "adjustedText": "the rewritten post with the new tone",
  "originalText": "${text}",
  "tone": "${tone}"
}

Important:
- Keep the core message and meaning the same
- Match the character count as closely as possible
- Preserve any hashtags, mentions, or links
- Make the changes subtle and natural

Your response MUST be valid JSON only. Start with { and end with }.`,
    };
  },
});
