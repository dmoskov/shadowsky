/**
 * Lambda Warmup Utility
 *
 * Detects and handles CloudWatch Events warmup invocations to keep Lambda
 * containers warm and eliminate cold start latency for AI features.
 *
 * When a warmup event is detected, the function returns immediately without
 * executing the main handler logic, minimizing execution time and cost.
 */

/**
 * Warmup event structure sent by CloudWatch Events
 */
export interface WarmupEvent {
  source: 'aws.events';
  'detail-type': 'Scheduled Event';
  detail: {
    warmup?: boolean;
  };
}

/**
 * Warmup response returned when a warmup event is detected
 */
export interface WarmupResponse {
  statusCode: 200;
  body: string;
  headers: {
    'Content-Type': string;
    'X-Warmup': string;
  };
}

/**
 * Check if the incoming event is a warmup invocation from CloudWatch Events
 *
 * @param event - The Lambda event object
 * @returns true if this is a warmup event
 */
export function isWarmupEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const e = event as Record<string, unknown>;

  // Check for CloudWatch Events scheduled event pattern
  if (e.source === 'aws.events' && e['detail-type'] === 'Scheduled Event') {
    // Additional check for warmup marker in detail (optional but recommended)
    const detail = e.detail as Record<string, unknown> | undefined;
    if (detail?.warmup === true) {
      return true;
    }
    // Still consider it a warmup if it's from our warmup rule (no HTTP method/body)
    if (!e.httpMethod && !e.body && !e.requestContext) {
      return true;
    }
  }

  // Check for direct invocation with warmup marker
  if (e.warmup === true) {
    return true;
  }

  return false;
}

/**
 * Create a response for warmup events
 *
 * @param handlerName - Name of the handler for logging purposes
 * @returns A minimal response indicating warmup was handled
 */
export function createWarmupResponse(handlerName: string): WarmupResponse {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Warmup successful',
      handler: handlerName,
      timestamp: new Date().toISOString(),
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Warmup': 'true',
    },
  };
}

/**
 * Handle warmup event if detected
 *
 * Returns a warmup response if this is a warmup event, or null if not.
 * This allows handlers to easily check and short-circuit:
 *
 * ```ts
 * const warmupResponse = handleWarmupEvent(event, 'my-handler');
 * if (warmupResponse) {
 *   return warmupResponse;
 * }
 * // Continue with normal handler logic...
 * ```
 *
 * @param event - The Lambda event object
 * @param handlerName - Name of the handler for logging purposes
 * @returns WarmupResponse if this is a warmup event, null otherwise
 */
export function handleWarmupEvent(
  event: unknown,
  handlerName: string
): WarmupResponse | null {
  if (isWarmupEvent(event)) {
    // Log warmup for monitoring (minimal to reduce overhead)
    console.log(`[${handlerName}] Warmup invocation handled`);
    return createWarmupResponse(handlerName);
  }
  return null;
}
