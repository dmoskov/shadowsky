/**
 * Style Analysis Response Schema
 *
 * Validates responses from the style-analysis handler which analyzes a user's
 * writing style based on historical posts and compares a current draft.
 */

import { z } from 'zod';

export const StyleAnalysisResponseSchema = z.object({
  userStyleSummary: z.string().min(1, 'userStyleSummary cannot be empty'),
  matchesStyle: z.boolean(),
  styleNotes: z
    .array(z.string())
    .min(2, 'styleNotes must have at least 2 items')
    .max(4, 'styleNotes should have at most 4 items'),
});

export type StyleAnalysisResponse = z.infer<typeof StyleAnalysisResponseSchema>;
