/**
 * Schema Validation Tests
 *
 * Tests for Zod schema validation utilities and AI response schemas.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateSchema,
  validateOrThrow,
  SchemaValidationError,
  registerSchema,
  getSchema,
  RESPONSE_SCHEMAS,
} from '../schemas/validation';
import {
  AdjustToneResponseSchema,
  AnalyzePostsResponseSchema,
  OptimizeThreadResponseSchema,
  StyleAnalysisResponseSchema,
  SuggestHashtagsResponseSchema,
  WritingFeedbackResponseSchema,
} from '../schemas';

describe('schema-validation utilities', () => {
  describe('validateSchema', () => {
    const TestSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    it('should return success for valid data', () => {
      const result = validateSchema(TestSchema, { name: 'test', value: 42 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 42 });
      expect(result.error).toBeUndefined();
    });

    it('should return failure for invalid data', () => {
      const result = validateSchema(TestSchema, { name: 'test', value: 'not a number' });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0].path).toBe('value');
    });

    it('should return failure for missing required fields', () => {
      const result = validateSchema(TestSchema, { name: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0].path).toBe('value');
    });

    it('should return multiple issues for multiple invalid fields', () => {
      const result = validateSchema(TestSchema, { name: 123, value: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateOrThrow', () => {
    const TestSchema = z.object({
      text: z.string().min(1),
    });

    it('should return data for valid input', () => {
      const result = validateOrThrow('test-handler', TestSchema, { text: 'hello' });

      expect(result).toEqual({ text: 'hello' });
    });

    it('should throw SchemaValidationError for invalid input', () => {
      expect(() => validateOrThrow('test-handler', TestSchema, { text: '' })).toThrow(
        SchemaValidationError
      );
    });

    it('should include handler name in error', () => {
      try {
        validateOrThrow('my-handler', TestSchema, { text: '' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).handlerName).toBe('my-handler');
        expect((error as SchemaValidationError).message).toContain('my-handler');
      }
    });

    it('should include validation issues in error', () => {
      try {
        validateOrThrow('test-handler', TestSchema, { text: '' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('schema registry', () => {
    it('should register and retrieve schemas', () => {
      const TestSchema = z.object({ test: z.string() });

      registerSchema('test-schema', TestSchema);

      expect(getSchema('test-schema')).toBe(TestSchema);
    });

    it('should return undefined for unregistered schemas', () => {
      expect(getSchema('non-existent-schema')).toBeUndefined();
    });
  });
});

describe('AI response schemas', () => {
  describe('AdjustToneResponseSchema', () => {
    it('should validate valid adjust-tone response', () => {
      const validResponse = {
        adjustedText: 'This is the adjusted text',
        originalText: 'This is the original text',
        tone: 'professional',
      };

      const result = validateSchema(AdjustToneResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject empty adjustedText', () => {
      const invalidResponse = {
        adjustedText: '',
        originalText: 'Original',
        tone: 'casual',
      };

      const result = validateSchema(AdjustToneResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toBe('adjustedText');
    });

    it('should reject missing fields', () => {
      const invalidResponse = {
        adjustedText: 'Adjusted',
      };

      const result = validateSchema(AdjustToneResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('AnalyzePostsResponseSchema', () => {
    it('should validate valid analyze-posts response', () => {
      const validResponse = {
        contentThemes: [
          {
            theme: 'Technology',
            description: 'Posts about tech',
            frequency: 'primary',
            examples: ['Example 1'],
          },
        ],
        writingStyle: {
          tone: 'Casual and conversational',
          characteristics: ['Brief', 'Uses emojis'],
          voiceDescription: 'Friendly and engaging',
        },
        engagementPatterns: {
          topPerformers: ['Tech posts'],
          contentStrengths: ['Clear writing'],
          suggestions: ['Post more often'],
        },
        summary: 'This user posts about technology.',
      };

      const result = validateSchema(AnalyzePostsResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid frequency value', () => {
      const invalidResponse = {
        contentThemes: [
          {
            theme: 'Tech',
            description: 'Tech posts',
            frequency: 'always', // Invalid - should be primary/regular/occasional
            examples: ['Example'],
          },
        ],
        writingStyle: {
          tone: 'Casual',
          characteristics: ['Brief'],
          voiceDescription: 'Friendly',
        },
        engagementPatterns: {
          topPerformers: [],
          contentStrengths: [],
          suggestions: [],
        },
        summary: 'Summary',
      };

      const result = validateSchema(AnalyzePostsResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject empty contentThemes array', () => {
      const invalidResponse = {
        contentThemes: [],
        writingStyle: {
          tone: 'Casual',
          characteristics: ['Brief'],
          voiceDescription: 'Friendly',
        },
        engagementPatterns: {
          topPerformers: [],
          contentStrengths: [],
          suggestions: [],
        },
        summary: 'Summary',
      };

      const result = validateSchema(AnalyzePostsResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('OptimizeThreadResponseSchema', () => {
    it('should validate valid optimize-thread response', () => {
      const validResponse = {
        segments: [
          { text: 'First post', number: 1, isStandalone: true },
          { text: 'Second post', number: 2, isStandalone: false },
        ],
        summary: 'A thread about testing',
        suggestedFormat: 'brackets',
        totalPosts: 2,
      };

      const result = validateSchema(OptimizeThreadResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid suggestedFormat', () => {
      const invalidResponse = {
        segments: [{ text: 'Post', number: 1, isStandalone: true }],
        summary: 'Summary',
        suggestedFormat: 'invalid-format',
        totalPosts: 1,
      };

      const result = validateSchema(OptimizeThreadResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should validate all suggestedFormat options', () => {
      const formats = ['simple', 'brackets', 'thread', 'dots'] as const;

      for (const format of formats) {
        const response = {
          segments: [{ text: 'Post', number: 1, isStandalone: true }],
          summary: 'Summary',
          suggestedFormat: format,
          totalPosts: 1,
        };

        const result = validateSchema(OptimizeThreadResponseSchema, response);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('StyleAnalysisResponseSchema', () => {
    it('should validate valid style-analysis response', () => {
      const validResponse = {
        userStyleSummary: 'Your writing is casual and uses emojis.',
        matchesStyle: true,
        styleNotes: ['Matches casual tone', 'Similar emoji usage'],
      };

      const result = validateSchema(StyleAnalysisResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should require at least 2 styleNotes', () => {
      const invalidResponse = {
        userStyleSummary: 'Your writing is casual.',
        matchesStyle: true,
        styleNotes: ['Only one note'],
      };

      const result = validateSchema(StyleAnalysisResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('styleNotes');
    });

    it('should reject more than 4 styleNotes', () => {
      const invalidResponse = {
        userStyleSummary: 'Your writing is casual.',
        matchesStyle: true,
        styleNotes: ['Note 1', 'Note 2', 'Note 3', 'Note 4', 'Note 5'],
      };

      const result = validateSchema(StyleAnalysisResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('SuggestHashtagsResponseSchema', () => {
    it('should validate valid suggest-hashtags response', () => {
      const validResponse = {
        hashtags: [
          { tag: 'JavaScript', relevance: 0.95, isTrending: true },
          { tag: 'WebDev', relevance: 0.8, isTrending: false },
        ],
        category: 'Technology',
      };

      const result = validateSchema(SuggestHashtagsResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject relevance outside 0-1 range', () => {
      const invalidResponse = {
        hashtags: [{ tag: 'Test', relevance: 1.5, isTrending: false }],
        category: 'Testing',
      };

      const result = validateSchema(SuggestHashtagsResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject empty hashtags array', () => {
      const invalidResponse = {
        hashtags: [],
        category: 'Empty',
      };

      const result = validateSchema(SuggestHashtagsResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('WritingFeedbackResponseSchema', () => {
    it('should validate valid writing-feedback response', () => {
      const validResponse = {
        assessment: {
          summary: 'Good post with minor typos.',
          hasIssues: true,
        },
        correctedVersion: {
          text: 'Corrected text here',
          changes: ['Fixed typo'],
        },
        enhancedVersion: {
          text: 'Enhanced text here',
          improvements: ['Made more concise'],
        },
      };

      const result = validateSchema(WritingFeedbackResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should allow empty changes array', () => {
      const validResponse = {
        assessment: {
          summary: 'Perfect post!',
          hasIssues: false,
        },
        correctedVersion: {
          text: 'Same text',
          changes: [], // No changes needed
        },
        enhancedVersion: {
          text: 'Slightly enhanced',
          improvements: ['Added emphasis'],
        },
      };

      const result = validateSchema(WritingFeedbackResponseSchema, validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject missing assessment', () => {
      const invalidResponse = {
        correctedVersion: {
          text: 'Text',
          changes: [],
        },
        enhancedVersion: {
          text: 'Text',
          improvements: [],
        },
      };

      const result = validateSchema(WritingFeedbackResponseSchema, invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});
