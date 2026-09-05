/**
 * Lambda Middleware
 *
 * Provides higher-order functions for wrapping Lambda handlers with common
 * setup and teardown patterns, reducing code duplication across handlers.
 *
 * Features:
 * - Warmup event detection (CloudWatch scheduled events)
 * - CORS preflight (OPTIONS) handling
 * - Correlation ID extraction/generation
 * - Optional API key verification
 * - Consistent error handling
 *
 * Usage:
 * ```ts
 * export const handler = withCommonSetup({
 *   name: 'my-handler',
 *   enableWarmup: true,
 * })(async (event, context) => {
 *   const { correlationId } = context;
 *   // Handler logic here...
 *   return createSuccessResponse(result, event, { correlationId });
 * });
 * ```
 */

import {
  createConfigError,
  createInternalError,
  createOptionsResponse,
  getCorrelationId,
  isOptionsRequest,
  logError,
  type LambdaResponse,
} from './api-response';
import { anthropicAvailable, getAnthropicApiKey } from './anthropic-credentials';
import { handleWarmupEvent } from './warmup';

/**
 * Context provided to wrapped handlers
 */
export interface MiddlewareContext {
  /** Correlation ID for request tracing */
  correlationId: string;
  /** Handler name for logging */
  handlerName: string;
  /** API key from environment (only if requireApiKey is true) */
  apiKey?: string;
}

/**
 * Configuration for middleware setup
 */
export interface MiddlewareConfig {
  /** Handler name for logging and warmup responses */
  name: string;
  /** Enable warmup event detection (default: true) */
  enableWarmup?: boolean;
  /** Require ANTHROPIC_API_KEY environment variable */
  requireApiKey?: boolean;
  /** Custom environment variable name for API key */
  apiKeyEnvVar?: string;
}

/**
 * Handler function type for wrapped handlers
 */
export type WrappedHandler<T = any> = (
  event: T,
  context: MiddlewareContext
) => Promise<LambdaResponse>;

/**
 * Creates a middleware wrapper that applies common setup patterns to Lambda handlers.
 *
 * This is a higher-order function that returns a handler wrapper. The wrapper
 * handles common patterns like warmup detection, CORS preflight, correlation IDs,
 * and optional API key verification before delegating to the actual handler.
 *
 * @param config Middleware configuration
 * @returns A function that wraps a handler with common setup
 *
 * @example
 * // Basic usage with warmup and CORS handling
 * export const handler = withCommonSetup({
 *   name: 'fetch-link-metadata',
 * })(async (event, { correlationId }) => {
 *   // Your handler logic
 *   return createSuccessResponse(result, event, { correlationId });
 * });
 *
 * @example
 * // With API key requirement
 * export const handler = withCommonSetup({
 *   name: 'analyze-posts',
 *   requireApiKey: true,
 * })(async (event, { correlationId, apiKey }) => {
 *   // Use apiKey for Anthropic API calls
 *   return createSuccessResponse(result, event, { correlationId });
 * });
 */
export function withCommonSetup(config: MiddlewareConfig) {
  const {
    name,
    enableWarmup = true,
    requireApiKey = false,
    apiKeyEnvVar = 'ANTHROPIC_API_KEY',
  } = config;

  return function wrapper<T = any>(handler: WrappedHandler<T>) {
    return async (event: T): Promise<LambdaResponse> => {
      // 1. Handle warmup events immediately to minimize cold start latency
      if (enableWarmup) {
        const warmupResponse = handleWarmupEvent(event, name);
        if (warmupResponse) {
          return warmupResponse;
        }
      }

      // 2. Extract or generate correlation ID for request tracing
      const correlationId = getCorrelationId(event);

      // 3. Handle CORS preflight OPTIONS requests
      if (isOptionsRequest(event)) {
        return createOptionsResponse(event);
      }

      try {
        // 4. Verify API credentials if required (static key or federation)
        let apiKey: string | undefined;
        if (requireApiKey) {
          if (anthropicAvailable()) {
            apiKey = await getAnthropicApiKey();
          } else if (apiKeyEnvVar !== 'ANTHROPIC_API_KEY' && process.env[apiKeyEnvVar]) {
            apiKey = process.env[apiKeyEnvVar];
          } else {
            return createConfigError(apiKeyEnvVar, event, correlationId);
          }
        }

        // 5. Build context and delegate to handler
        const context: MiddlewareContext = {
          correlationId,
          handlerName: name,
          apiKey,
        };

        return await handler(event, context);
      } catch (error) {
        // 6. Handle uncaught errors
        logError(name, error, correlationId);
        return createInternalError(error, event, correlationId);
      }
    };
  };
}

/**
 * Type guard to check if an event is an API Gateway event with body
 */
export function isApiGatewayEvent(event: unknown): event is {
  body?: string;
  headers?: Record<string, string>;
  httpMethod?: string;
} {
  return (
    typeof event === 'object' &&
    event !== null &&
    ('body' in event || 'headers' in event || 'httpMethod' in event)
  );
}
