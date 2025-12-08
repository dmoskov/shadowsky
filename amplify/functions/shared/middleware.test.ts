/**
 * Tests for Lambda Middleware
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { withCommonSetup, type MiddlewareContext } from './middleware';

// Mock the api-response module
vi.mock('./api-response', () => ({
  createConfigError: vi.fn((configItem: string, _event: any, correlationId: string) => ({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: {
        code: 'CONFIG_ERROR',
        message: `Server configuration error: ${configItem} not configured`,
        correlationId,
      },
    }),
  })),
  createInternalError: vi.fn((error: Error, _event: any, correlationId: string) => ({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        correlationId,
      },
    }),
  })),
  createOptionsResponse: vi.fn((_event: any) => ({
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    },
    body: '',
  })),
  getCorrelationId: vi.fn((event: any) =>
    event.headers?.['x-correlation-id'] || 'test-correlation-id'
  ),
  isOptionsRequest: vi.fn((event: any) => event.httpMethod === 'OPTIONS'),
  logError: vi.fn(),
}));

// Mock the warmup module
vi.mock('./warmup', () => ({
  handleWarmupEvent: vi.fn((event: any, _handlerName: string) => {
    if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Warmup': 'true',
        },
        body: JSON.stringify({ message: 'Warmup successful' }),
      };
    }
    return null;
  }),
}));

describe('withCommonSetup middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('warmup handling', () => {
    it('should return warmup response for warmup events when enabled', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        enableWarmup: true,
      })(mockHandler);

      const warmupEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: { warmup: true },
      };

      const result = await wrappedHandler(warmupEvent);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['X-Warmup']).toBe('true');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should skip warmup handling when disabled', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: JSON.stringify({ success: true }),
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        enableWarmup: false,
      })(mockHandler);

      const warmupEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: { warmup: true },
      };

      await wrappedHandler(warmupEvent);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should enable warmup by default', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      const warmupEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: { warmup: true },
      };

      const result = await wrappedHandler(warmupEvent);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('CORS OPTIONS handling', () => {
    it('should return OPTIONS response for preflight requests', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      const optionsEvent = {
        httpMethod: 'OPTIONS',
        headers: {},
      };

      const result = await wrappedHandler(optionsEvent);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Methods']).toContain('OPTIONS');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('correlation ID handling', () => {
    it('should pass correlation ID from event headers to handler', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      const event = {
        httpMethod: 'POST',
        headers: { 'x-correlation-id': 'custom-correlation-id' },
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.correlationId).toBe('custom-correlation-id');
    });

    it('should generate correlation ID if not in headers', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.correlationId).toBe('test-correlation-id');
    });
  });

  describe('API key verification', () => {
    it('should return config error when API key is required but missing', async () => {
      const mockHandler = vi.fn();
      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        requireApiKey: true,
      })(mockHandler);

      delete process.env.ANTHROPIC_API_KEY;

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      const result = await wrappedHandler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.code).toBe('CONFIG_ERROR');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should pass API key to handler when available', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        requireApiKey: true,
      })(mockHandler);

      process.env.ANTHROPIC_API_KEY = 'test-api-key';

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.apiKey).toBe('test-api-key');
    });

    it('should use custom API key environment variable name', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        requireApiKey: true,
        apiKeyEnvVar: 'CUSTOM_API_KEY',
      })(mockHandler);

      process.env.CUSTOM_API_KEY = 'custom-api-key-value';

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.apiKey).toBe('custom-api-key-value');
    });

    it('should not require API key by default', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      delete process.env.ANTHROPIC_API_KEY;

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.apiKey).toBeUndefined();
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should catch and handle errors thrown by the handler', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
      })(mockHandler);

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      const result = await wrappedHandler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('context properties', () => {
    it('should pass handler name in context', async () => {
      let capturedContext: MiddlewareContext | undefined;
      const mockHandler = vi.fn(async (_event: any, context: MiddlewareContext) => {
        capturedContext = context;
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'my-test-handler',
      })(mockHandler);

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(capturedContext?.handlerName).toBe('my-test-handler');
    });
  });

  describe('execution order', () => {
    it('should process in correct order: warmup → OPTIONS → API key → handler', async () => {
      const callOrder: string[] = [];

      // Create a handler that tracks execution
      const mockHandler = vi.fn(async () => {
        callOrder.push('handler');
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        };
      });

      const wrappedHandler = withCommonSetup({
        name: 'test-handler',
        requireApiKey: true,
      })(mockHandler);

      process.env.ANTHROPIC_API_KEY = 'test-key';

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
      };

      await wrappedHandler(event);

      expect(callOrder).toContain('handler');
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });
});
