/**
 * Suggest Hashtags Response Schema
 *
 * Validates responses from the suggest-hashtags handler which suggests
 * relevant hashtags with relevance scores and trending indicators.
 */

import { z } from 'zod';

const HashtagSchema = z.object({
  tag: z.string().min(1, 'tag cannot be empty'),
  relevance: z.number().min(0).max(1),
  isTrending: z.boolean(),
});

export const SuggestHashtagsResponseSchema = z.object({
  hashtags: z.array(HashtagSchema).min(1, 'hashtags must have at least one item'),
  category: z.string().min(1, 'category cannot be empty'),
});

export type SuggestHashtagsResponse = z.infer<typeof SuggestHashtagsResponseSchema>;
