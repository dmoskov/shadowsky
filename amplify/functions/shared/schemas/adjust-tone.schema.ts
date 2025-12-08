/**
 * Adjust Tone Response Schema
 *
 * Validates responses from the adjust-tone handler which rewrites social media
 * posts with a different tone while preserving the core message.
 */

import { z } from 'zod';

export const AdjustToneResponseSchema = z.object({
  adjustedText: z.string().min(1, 'adjustedText cannot be empty'),
  originalText: z.string().min(1, 'originalText cannot be empty'),
  tone: z.string().min(1, 'tone cannot be empty'),
});

export type AdjustToneResponse = z.infer<typeof AdjustToneResponseSchema>;
