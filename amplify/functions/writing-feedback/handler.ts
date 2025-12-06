/**
 * Writing Feedback Handler
 *
 * Analyzes social media posts and provides feedback with corrected
 * and enhanced versions while preserving the author's voice.
 */

import { createAnthropicHandler, truncateText } from '../shared/handler-factory';
import { MODELS } from '../shared/model-config';

interface RequestBody {
  text?: string;
}

export const handler = createAnthropicHandler<RequestBody>({
  name: 'writing-feedback',
  requiredParams: ['text'],
  logMessage: () => 'Processing feedback request',
  buildPrompt: (body) => {
    const text = body.text!;
    const truncatedText = truncateText(text, 2000);

    return {
      model: MODELS.SONNET,
      maxTokens: 1500,
      prompt: `Analyze this social media post and provide helpful feedback with improved versions.

Post: "${truncatedText}"

Provide a JSON response with:
1. assessment:
   - summary: brief quality assessment (1-2 sentences)
   - hasIssues: boolean indicating if there are typos or issues
2. correctedVersion:
   - text: the post with ONLY typos, grammar, and spelling fixed (minimal changes)
   - changes: array of strings describing corrections (e.g. ["Fixed spelling of 'spelling'", "Corrected grammar"]) - empty array if none needed
3. enhancedVersion:
   - text: a slightly improved version (just a little better - keep the original voice and style)
   - improvements: array of strings describing what was enhanced

Keep corrections minimal and enhancements subtle. Preserve the author's voice.

Example JSON structure:
{
  "assessment": { "summary": "...", "hasIssues": true },
  "correctedVersion": { "text": "...", "changes": ["Fixed X", "Corrected Y"] },
  "enhancedVersion": { "text": "...", "improvements": ["Made more concise", "Enhanced clarity"] }
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Use proper JSON arrays with strings only (no arrow notation like "a" -> "b")
2. Ensure all arrays and objects are properly closed with ] and }
3. Double-check that your JSON is valid before responding
4. Do not include any text before or after the JSON object
5. Start directly with { and end with }`,
    };
  },
});
