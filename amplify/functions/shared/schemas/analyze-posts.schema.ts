/**
 * Analyze Posts Response Schema
 *
 * Validates responses from the analyze-posts handler which provides insights
 * about content themes, writing style, and engagement patterns.
 */

import { z } from 'zod';

const ContentThemeSchema = z.object({
  theme: z.string().min(1, 'theme cannot be empty'),
  description: z.string().min(1, 'description cannot be empty'),
  frequency: z.enum(['primary', 'regular', 'occasional']),
  examples: z.array(z.string()).min(1, 'examples must have at least one item'),
});

const WritingStyleSchema = z.object({
  tone: z.string().min(1, 'tone cannot be empty'),
  characteristics: z.array(z.string()).min(1, 'characteristics must have at least one item'),
  voiceDescription: z.string().min(1, 'voiceDescription cannot be empty'),
});

const EngagementPatternsSchema = z.object({
  topPerformers: z.array(z.string()),
  contentStrengths: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export const AnalyzePostsResponseSchema = z.object({
  contentThemes: z.array(ContentThemeSchema).min(1, 'contentThemes must have at least one theme'),
  writingStyle: WritingStyleSchema,
  engagementPatterns: EngagementPatternsSchema,
  summary: z.string().min(1, 'summary cannot be empty'),
});

export type AnalyzePostsResponse = z.infer<typeof AnalyzePostsResponseSchema>;
