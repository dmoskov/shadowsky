/**
 * Writing Feedback Response Schema
 *
 * Validates responses from the writing-feedback handler which provides
 * feedback with corrected and enhanced versions of social media posts.
 */

import { z } from 'zod';

const AssessmentSchema = z.object({
  summary: z.string().min(1, 'summary cannot be empty'),
  hasIssues: z.boolean(),
});

const CorrectedVersionSchema = z.object({
  text: z.string().min(1, 'text cannot be empty'),
  changes: z.array(z.string()),
});

const EnhancedVersionSchema = z.object({
  text: z.string().min(1, 'text cannot be empty'),
  improvements: z.array(z.string()),
});

export const WritingFeedbackResponseSchema = z.object({
  assessment: AssessmentSchema,
  correctedVersion: CorrectedVersionSchema,
  enhancedVersion: EnhancedVersionSchema,
});

export type WritingFeedbackResponse = z.infer<typeof WritingFeedbackResponseSchema>;
