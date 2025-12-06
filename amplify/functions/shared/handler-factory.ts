/**
 * Lambda Handler Factory
 *
 * Provides a standardized factory for creating Lambda handlers that use the
 * Anthropic API. Eliminates duplication of common patterns across handlers:
 * - CORS/OPTIONS handling
 * - Body parsing and validation
 * - API key verification
 * - Anthropic client creation
 * - Error handling (validation, API, timeout, unknown)
 *
 * Usage:
 * ```ts
 * export const handler = createAnthropicHandler({
 *   name: 'my-handler',
 *   requiredParams: ['text'],
 *   buildPrompt: (body) => ({
 *     model: MODELS.SONNET,
 *     maxTokens: 1000,
 *     prompt: `Analyze this: ${body.text}`,
 *   }),
 *   processResponse: (result) => result,
 * });
 * ```
 */

import {
  cleanJsonResponse,
  createConfigError,
  createExternalApiError,
  createInternalError,
  createInvalidParameterError,
  createMissingParameterError,
  createOptionsResponse,
  createSuccessResponse,
  createTimeoutError,
  getCorrelationId,
  isOptionsRequest,
  logError,
  logInfo,
  parseEventBody,
  type LambdaResponse,
} from './api-response';
import {
  createAnthropicClient,
  MaxRetriesExceededError,
  TimeoutError,
  type ResilienceConfig,
} from './resilience';

/**
 * Configuration for building the Anthropic API prompt
 */
export interface PromptConfig {
  /** Model to use (from MODELS constant) */
  model: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** The prompt to send to Claude */
  prompt: string;
  /** Optional system prompt */
  system?: string;
}

/**
 * Validation result for custom validators
 */
export interface ValidationResult {
  valid: boolean;
  error?: {
    paramName: string;
    reason: string;
  };
}

/**
 * Configuration for creating an Anthropic-based handler
 */
export interface AnthropicHandlerConfig<TBody = Record<string, unknown>, TResult = unknown> {
  /** Handler name for logging */
  name: string;
  /** Required parameters that must be present in the request body */
  requiredParams?: string[];
  /** Optional custom validation function */
  validate?: (body: TBody) => ValidationResult;
  /** Function to build the prompt from the request body */
  buildPrompt: (body: TBody, correlationId: string) => PromptConfig;
  /** Function to process the response before returning */
  processResponse?: (result: unknown, body: TBody) => TResult;
  /** Optional logging message before API call */
  logMessage?: (body: TBody) => string;
  /** Optional resilience config overrides */
  resilienceConfig?: Partial<ResilienceConfig>;
}

/**
 * Configuration for the Anthropic API request
 */
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Create a Lambda handler that calls the Anthropic API
 *
 * @param config Handler configuration
 * @returns Lambda handler function
 */
export function createAnthropicHandler<TBody = Record<string, unknown>, TResult = unknown>(
  config: AnthropicHandlerConfig<TBody, TResult>
): (event: unknown) => Promise<LambdaResponse> {
  const {
    name,
    requiredParams = [],
    validate,
    buildPrompt,
    processResponse = (result) => result as TResult,
    logMessage,
    resilienceConfig,
  } = config;

  return async (event: unknown): Promise<LambdaResponse> => {
    const correlationId = getCorrelationId(event);

    // Handle OPTIONS request for CORS preflight
    if (isOptionsRequest(event)) {
      return createOptionsResponse(event);
    }

    try {
      // Parse request body
      const body = parseEventBody<TBody>(event);
      if (!body) {
        return createInvalidParameterError('body', 'Invalid JSON format', event, correlationId);
      }

      // Check required parameters
      for (const param of requiredParams) {
        const value = (body as Record<string, unknown>)[param];
        if (value === undefined || value === null || value === '') {
          return createMissingParameterError(param, event, correlationId);
        }
      }

      // Run custom validation if provided
      if (validate) {
        const validationResult = validate(body);
        if (!validationResult.valid && validationResult.error) {
          return createInvalidParameterError(
            validationResult.error.paramName,
            validationResult.error.reason,
            event,
            correlationId
          );
        }
      }

      // Check API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return createConfigError('ANTHROPIC_API_KEY', event, correlationId);
      }

      // Log operation start
      const message = logMessage ? logMessage(body) : `Processing ${name} request`;
      logInfo(name, message, correlationId);

      // Build prompt configuration
      const promptConfig = buildPrompt(body, correlationId);

      // Create resilient client
      const client = createAnthropicClient({
        name,
        ...resilienceConfig,
      });

      try {
        // Build API request
        const apiRequest: AnthropicRequest = {
          model: promptConfig.model,
          max_tokens: promptConfig.maxTokens,
          messages: [
            {
              role: 'user',
              content: promptConfig.prompt,
            },
          ],
        };

        // Make API call
        const response = await client.fetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify(apiRequest),
          },
          correlationId
        );

        // Parse response
        const data = await response.json();
        const responseText = data.content?.[0]?.text;

        if (!responseText) {
          throw new Error('Empty response from Anthropic API');
        }

        // Clean and parse JSON response
        const cleanedText = cleanJsonResponse(responseText);
        const result = JSON.parse(cleanedText);

        // Process response
        const processedResult = processResponse(result, body);

        logInfo(name, `${name} completed successfully`, correlationId);

        return createSuccessResponse(processedResult, event, { correlationId });
      } catch (apiError) {
        // Handle timeout errors
        if (apiError instanceof TimeoutError) {
          logError(name, apiError, correlationId, { errorType: 'timeout' });
          return createTimeoutError('Anthropic API call', event, correlationId);
        }

        // Handle max retries exceeded
        if (apiError instanceof MaxRetriesExceededError) {
          logError(name, apiError, correlationId, { attempts: apiError.attempts });
          return createExternalApiError(
            'Anthropic',
            `Failed after ${apiError.attempts} attempts`,
            event,
            correlationId
          );
        }

        // Re-throw unknown API errors
        throw apiError;
      }
    } catch (error) {
      logError(name, error, correlationId);
      return createInternalError(error, event, correlationId);
    }
  };
}

/**
 * Helper to truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}
