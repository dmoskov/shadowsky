/**
 * Handler Factory Tests
 *
 * Tests for the createAnthropicHandler factory function.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  createAnthropicHandler,
  truncateText,
  type AnthropicHandlerConfig,
} from '../handler-factory';
import { MODELS } from '../model-config';

// Mock the resilience module
vi.mock('../resilience', () => {
  const mockClient = {
    fetch: vi.fn(),
  };
  return {
    createAnthropicClient: vi.fn(() => mockClient),
    TimeoutError: class TimeoutError extends Error {
      code = 'TIMEOUT_ERROR';
      isTimeout = true;
      timeoutMs: number;
      constructor(message: string, timeoutMs: number) {
        super(message);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
      }
    },
    MaxRetriesExceededError: class MaxRetriesExceededError extends Error {
      code = 'MAX_RETRIES_EXCEEDED';
      attempts: number;
      lastError: unknown;
      constructor(message: string, attempts: number, lastError: unknown) {
        super(message);
        this.name = 'MaxRetriesExceededError';
        this.attempts = attempts;
        this.lastError = lastError;
      }
    },
  };
});

// Import mocked modules
const { createAnthropicClient, TimeoutError, MaxRetriesExceededError } = await import(
  '../resilience'
);

describe('handler-factory', () => {
  describe('truncateText', () => {
    it('should return original text if under max length', () => {
      const text = 'Hello world';
      expect(truncateText(text, 100)).toBe(text);
    });

    it('should truncate text with suffix at max length', () => {
      const text = 'Hello world';
      expect(truncateText(text, 8)).toBe('Hello...');
    });

    it('should use custom suffix', () => {
      const text = 'Hello world';
      expect(truncateText(text, 9, '…')).toBe('Hello wo…');
    });

    it('should handle exact length match', () => {
      const text = 'Hello';
      expect(truncateText(text, 5)).toBe('Hello');
    });
  });

  describe('createAnthropicHandler', () => {
    const originalEnv = process.env;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-api-key' };
      mockFetch = vi.fn();
      (createAnthropicClient as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: mockFetch,
      });
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    const createMockEvent = (body: unknown = {}) => ({
      httpMethod: 'POST',
      body: JSON.stringify(body),
      headers: { origin: 'https://localhost:5173' },
      requestContext: { requestId: 'test-correlation-id' },
    });

    const createBasicConfig = (): AnthropicHandlerConfig => ({
      name: 'test-handler',
      requiredParams: ['text'],
      buildPrompt: (body: Record<string, unknown>) => ({
        model: MODELS.SONNET,
        maxTokens: 1000,
        prompt: `Process: ${body.text}`,
      }),
    });

    it('should return OPTIONS response for preflight requests', async () => {
      const handler = createAnthropicHandler(createBasicConfig());
      const event = { httpMethod: 'OPTIONS', headers: { origin: 'https://localhost:5173' } };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // CORS response will be set based on allowed origins configured in api-response
      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
    });

    it('should return error for missing required parameters', async () => {
      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({});

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MISSING_PARAMETER');
      expect(body.error.message).toContain('text');
    });

    it('should return error for invalid JSON body', async () => {
      const handler = createAnthropicHandler(createBasicConfig());
      const event = {
        httpMethod: 'POST',
        body: 'invalid json',
        headers: { origin: 'https://localhost:5173' },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should return error when API key is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CONFIG_ERROR');
    });

    it('should call Anthropic API with correct parameters', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          content: [{ text: '{"result": "success"}' }],
        }),
      });

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello world' });

      await handler(event);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.method).toBe('POST');

      const requestBody = JSON.parse(options.body);
      expect(requestBody.model).toBe(MODELS.SONNET);
      expect(requestBody.max_tokens).toBe(1000);
      expect(requestBody.messages[0].content).toContain('Hello world');
    });

    it('should return success response with parsed JSON', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          content: [{ text: '{"result": "processed"}' }],
        }),
      });

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.result).toBe('processed');
    });

    it('should clean markdown code fences from response', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          content: [{ text: '```json\n{"result": "processed"}\n```' }],
        }),
      });

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.result).toBe('processed');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new TimeoutError('Request timeout', 30000));

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(504);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TIMEOUT');
    });

    it('should handle max retries exceeded', async () => {
      mockFetch.mockRejectedValue(
        new MaxRetriesExceededError('Failed after retries', 3, new Error('Network error'))
      );

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EXTERNAL_API_ERROR');
      expect(body.error.message).toContain('3 attempts');
    });

    it('should handle custom validation', async () => {
      const config: AnthropicHandlerConfig = {
        name: 'test-handler',
        validate: (body: Record<string, unknown>) => {
          if (typeof body.value !== 'number') {
            return {
              valid: false,
              error: { paramName: 'value', reason: 'Must be a number' },
            };
          }
          return { valid: true };
        },
        buildPrompt: () => ({
          model: MODELS.SONNET,
          maxTokens: 1000,
          prompt: 'Test',
        }),
      };

      const handler = createAnthropicHandler(config);
      const event = createMockEvent({ value: 'not a number' });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_PARAMETER');
      expect(body.error.message).toContain('Must be a number');
    });

    it('should call processResponse transformer', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          content: [{ text: '{"items": [1, 2, 3]}' }],
        }),
      });

      const config: AnthropicHandlerConfig = {
        name: 'test-handler',
        buildPrompt: () => ({
          model: MODELS.SONNET,
          maxTokens: 1000,
          prompt: 'Test',
        }),
        processResponse: (result: unknown) => {
          const data = result as { items: number[] };
          return { count: data.items.length, items: data.items };
        },
      };

      const handler = createAnthropicHandler(config);
      const event = createMockEvent({});

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.count).toBe(3);
      expect(body.items).toEqual([1, 2, 3]);
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValue(new Error('Unknown error'));

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle empty API response', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          content: [{ text: '' }],
        }),
      });

      const handler = createAnthropicHandler(createBasicConfig());
      const event = createMockEvent({ text: 'Hello' });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    describe('schema validation', () => {
      const TestResponseSchema = z.object({
        text: z.string().min(1),
        score: z.number().min(0).max(100),
      });

      it('should pass validation for valid AI response', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"text": "Hello", "score": 85}' }],
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          responseSchema: TestResponseSchema,
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.text).toBe('Hello');
        expect(body.score).toBe(85);
      });

      it('should return error for invalid AI response structure', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"text": "", "score": 85}' }], // Empty text is invalid
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          responseSchema: TestResponseSchema,
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(body.error.message).toContain('validation failed');
      });

      it('should return error for missing required fields in AI response', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"text": "Hello"}' }], // Missing score field
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          responseSchema: TestResponseSchema,
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return error for out-of-range values', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"text": "Hello", "score": 150}' }], // Score > 100
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          responseSchema: TestResponseSchema,
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should skip validation when no schema provided', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"anyField": "anyValue"}' }],
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          // No responseSchema provided
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.anyField).toBe('anyValue');
      });

      it('should run processResponse after validation passes', async () => {
        mockFetch.mockResolvedValue({
          json: () =>
            Promise.resolve({
              content: [{ text: '{"text": "Hello", "score": 85}' }],
            }),
        });

        const config: AnthropicHandlerConfig = {
          name: 'test-handler',
          buildPrompt: () => ({
            model: MODELS.SONNET,
            maxTokens: 1000,
            prompt: 'Test',
          }),
          responseSchema: TestResponseSchema,
          processResponse: (result: unknown) => {
            const data = result as { text: string; score: number };
            return { ...data, processed: true };
          },
        };

        const handler = createAnthropicHandler(config);
        const event = createMockEvent({});

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.text).toBe('Hello');
        expect(body.score).toBe(85);
        expect(body.processed).toBe(true);
      });
    });
  });
});

describe('model-config', () => {
  it('should export MODELS constant', async () => {
    const { MODELS } = await import('../model-config');
    expect(MODELS.SONNET).toBeDefined();
    expect(MODELS.HAIKU).toBeDefined();
    expect(MODELS.OPUS).toBeDefined();
  });

  it('should export DEFAULT_MAX_TOKENS constant', async () => {
    const { DEFAULT_MAX_TOKENS } = await import('../model-config');
    expect(DEFAULT_MAX_TOKENS.SONNET).toBe(1000);
    expect(DEFAULT_MAX_TOKENS.HAIKU).toBe(500);
    expect(DEFAULT_MAX_TOKENS.OPUS).toBe(2000);
  });
});
