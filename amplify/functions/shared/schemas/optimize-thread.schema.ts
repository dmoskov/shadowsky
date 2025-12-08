/**
 * Optimize Thread Response Schema
 *
 * Validates responses from the optimize-thread handler which splits long-form
 * content into optimal thread segments for social media posting.
 */

import { z } from 'zod';

const ThreadSegmentSchema = z.object({
  text: z.string().min(1, 'text cannot be empty'),
  number: z.number().int().positive(),
  isStandalone: z.boolean(),
});

export const OptimizeThreadResponseSchema = z.object({
  segments: z.array(ThreadSegmentSchema).min(1, 'segments must have at least one segment'),
  summary: z.string().min(1, 'summary cannot be empty'),
  suggestedFormat: z.enum(['simple', 'brackets', 'thread', 'dots']),
  totalPosts: z.number().int().positive(),
});

export type OptimizeThreadResponse = z.infer<typeof OptimizeThreadResponseSchema>;
