/**
 * Style Analysis Handler
 *
 * Analyzes a user's writing style based on their historical posts and
 * compares a current draft to that established style.
 */

import { createAnthropicHandler, truncateText } from '../shared/handler-factory';
import { MODELS } from '../shared/model-config';

interface RequestBody {
  currentText?: string;
  historicalPosts?: string[];
}

export const handler = createAnthropicHandler<RequestBody>({
  name: 'style-analysis',
  requiredParams: ['currentText'],
  validate: (body) => {
    if (!body.historicalPosts || !Array.isArray(body.historicalPosts)) {
      return {
        valid: false,
        error: {
          paramName: 'historicalPosts',
          reason: 'Must be an array of strings',
        },
      };
    }
    return { valid: true };
  },
  logMessage: (body) =>
    `Analyzing style against ${body.historicalPosts?.length || 0} historical posts`,
  buildPrompt: (body) => {
    const currentText = body.currentText!;
    const historicalPosts = body.historicalPosts!;

    // Truncate posts to avoid context size issues
    const truncatePost = (text: string): string => truncateText(text, 500);

    // Build the historical posts context (limit to 20 posts)
    const historicalContext = historicalPosts
      .slice(0, 20)
      .map((post, i) => `${i + 1}. ${truncatePost(post)}`)
      .join('\n');

    return {
      model: MODELS.SONNET,
      maxTokens: 1000,
      prompt: `You are a writing style analyst. Analyze the user's writing style based on their historical posts, then compare their current draft to that style.

HISTORICAL POSTS:
${historicalContext}

CURRENT DRAFT:
"${truncateText(currentText, 1000)}"

Provide a JSON response with:
1. userStyleSummary: A 1-2 sentence description of their typical writing style (tone, patterns, word choice, post length, emoji usage, etc.)
2. matchesStyle: boolean indicating if the current draft matches their typical style
3. styleNotes: array of 2-4 specific observations about how this draft compares to their style (e.g., "Usually more casual", "Typically uses more emojis", "Shorter than usual posts", "More formal tone than typical")

Example JSON structure:
{
  "userStyleSummary": "Your posts are typically casual and conversational with frequent emoji use. You tend to keep things brief and punchy.",
  "matchesStyle": true,
  "styleNotes": [
    "Matches your usual conversational tone",
    "Similar length to your typical posts",
    "Consistent emoji usage"
  ]
}

IMPORTANT: Your response MUST be valid JSON only. Rules:
1. Keep userStyleSummary to 1-2 sentences maximum
2. Include 2-4 specific, actionable styleNotes
3. Base analysis on actual patterns from historical posts
4. Be constructive and helpful, not critical
5. Start directly with { and end with }`,
    };
  },
});
