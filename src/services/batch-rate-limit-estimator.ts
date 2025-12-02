/**
 * Batch Rate Limit Estimator Service
 *
 * Pre-flight estimation for batch operations to warn users before hitting rate limits.
 * This implements the "pre-flight estimation" strategy chosen for batch operations:
 * Calculate if batch will hit limits and warn user upfront.
 *
 * Decision documented in Asana task 1212248163215304:
 * - User selected Option 3: Pre-flight estimation
 * - Warns users before starting large batch operations
 * - Provides estimated time and risk assessment
 */

import {
  ATProtoEndpointType,
  getGlobalRateLimiter,
} from "./atproto/rate-limiter";

/**
 * Bluesky API rate limit thresholds (conservative estimates)
 * Based on AT Protocol documentation and observed behavior
 */
export const BLUESKY_RATE_LIMITS = {
  // Follow/unfollow operations use RECORD endpoint
  FOLLOW_OPERATIONS_PER_MINUTE: 30,
  FOLLOW_OPERATIONS_PER_HOUR: 300,

  // Mute/block operations
  MUTE_OPERATIONS_PER_MINUTE: 60,
  MUTE_OPERATIONS_PER_HOUR: 600,
  BLOCK_OPERATIONS_PER_MINUTE: 30,
  BLOCK_OPERATIONS_PER_HOUR: 300,

  // General API calls
  GENERAL_API_PER_MINUTE: 100,
  GENERAL_API_PER_HOUR: 1000,

  // Conservative safety margins (percentage to leave as buffer)
  SAFETY_MARGIN: 0.8, // Only use 80% of theoretical limit
} as const;

/**
 * Batch operation types for follower management
 */
export type BatchOperationType =
  | "follow"
  | "unfollow"
  | "mute"
  | "unmute"
  | "block"
  | "unblock";

/**
 * Risk level for batch operation
 */
export type RiskLevel = "safe" | "moderate" | "high" | "dangerous";

/**
 * Pre-flight estimation result
 */
export interface BatchEstimation {
  /** Whether the batch operation is recommended to proceed */
  canProceed: boolean;

  /** Risk level of the operation */
  riskLevel: RiskLevel;

  /** Total number of operations in the batch */
  totalOperations: number;

  /** Estimated time to complete in seconds */
  estimatedTimeSeconds: number;

  /** Estimated time formatted as human-readable string */
  estimatedTimeFormatted: string;

  /** Maximum safe batch size at current rate limit state */
  recommendedBatchSize: number;

  /** Current available tokens in rate limiter */
  availableTokens: number;

  /** Warning message if applicable */
  warningMessage?: string;

  /** Suggested actions if operation is risky */
  suggestions?: string[];

  /** Whether to show a confirmation dialog */
  requiresConfirmation: boolean;
}

/**
 * Configuration for batch operation
 */
export interface BatchConfig {
  /** Type of batch operation */
  operationType: BatchOperationType;

  /** Number of operations to perform */
  count: number;

  /** Delay between operations in ms (default: 200) */
  delayBetweenOps?: number;
}

/**
 * Get rate limit configuration for operation type
 */
function getRateLimitForOperation(operationType: BatchOperationType): {
  perMinute: number;
  perHour: number;
  endpointType: ATProtoEndpointType;
} {
  switch (operationType) {
    case "follow":
    case "unfollow":
      return {
        perMinute: BLUESKY_RATE_LIMITS.FOLLOW_OPERATIONS_PER_MINUTE,
        perHour: BLUESKY_RATE_LIMITS.FOLLOW_OPERATIONS_PER_HOUR,
        endpointType: ATProtoEndpointType.RECORD,
      };
    case "mute":
    case "unmute":
      return {
        perMinute: BLUESKY_RATE_LIMITS.MUTE_OPERATIONS_PER_MINUTE,
        perHour: BLUESKY_RATE_LIMITS.MUTE_OPERATIONS_PER_HOUR,
        endpointType: ATProtoEndpointType.RECORD,
      };
    case "block":
    case "unblock":
      return {
        perMinute: BLUESKY_RATE_LIMITS.BLOCK_OPERATIONS_PER_MINUTE,
        perHour: BLUESKY_RATE_LIMITS.BLOCK_OPERATIONS_PER_HOUR,
        endpointType: ATProtoEndpointType.RECORD,
      };
    default:
      return {
        perMinute: BLUESKY_RATE_LIMITS.GENERAL_API_PER_MINUTE,
        perHour: BLUESKY_RATE_LIMITS.GENERAL_API_PER_HOUR,
        endpointType: ATProtoEndpointType.FEED,
      };
  }
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)} seconds`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);

  if (minutes < 60) {
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Determine risk level based on operation count and rate limits
 */
function calculateRiskLevel(
  count: number,
  safeLimit: number,
  hourlyLimit: number,
): RiskLevel {
  const safeRatio = count / safeLimit;
  const hourlyRatio = count / hourlyLimit;

  if (safeRatio <= 0.5 && hourlyRatio <= 0.25) {
    return "safe";
  }
  if (safeRatio <= 1.0 && hourlyRatio <= 0.5) {
    return "moderate";
  }
  if (hourlyRatio <= 0.8) {
    return "high";
  }
  return "dangerous";
}

/**
 * Generate warning message based on risk level
 */
function generateWarningMessage(
  riskLevel: RiskLevel,
  count: number,
  operationType: BatchOperationType,
): string | undefined {
  const opName =
    operationType === "follow"
      ? "follow"
      : operationType === "unfollow"
        ? "unfollow"
        : operationType;

  switch (riskLevel) {
    case "safe":
      return undefined;
    case "moderate":
      return `${count} ${opName} operations will take a few minutes. You can continue using the app.`;
    case "high":
      return `${count} ${opName} operations is approaching Bluesky's rate limits. Consider doing this in smaller batches.`;
    case "dangerous":
      return `${count} ${opName} operations will likely hit Bluesky's rate limits. This may result in temporary restrictions on your account.`;
  }
}

/**
 * Generate suggestions based on risk level and batch size
 */
function generateSuggestions(
  riskLevel: RiskLevel,
  count: number,
  recommendedBatchSize: number,
): string[] | undefined {
  if (riskLevel === "safe") {
    return undefined;
  }

  const suggestions: string[] = [];

  if (riskLevel === "high" || riskLevel === "dangerous") {
    suggestions.push(
      `Consider processing in batches of ${recommendedBatchSize} at a time`,
    );
    suggestions.push("Wait a few minutes between batches to avoid rate limits");
  }

  if (riskLevel === "dangerous") {
    suggestions.push(
      "Large batch operations may trigger Bluesky's anti-spam measures",
    );
    suggestions.push("If rate limited, wait 5-10 minutes before trying again");
  }

  if (count > 500) {
    suggestions.push(
      "For very large batches, consider spreading operations over multiple sessions",
    );
  }

  return suggestions.length > 0 ? suggestions : undefined;
}

/**
 * Estimate batch operation impact on rate limits
 *
 * This is the main function for pre-flight estimation. Call this before
 * starting any batch operation to warn users about potential issues.
 *
 * @param config - Batch operation configuration
 * @returns Estimation result with recommendations
 *
 * @example
 * ```typescript
 * const estimation = estimateBatchOperation({
 *   operationType: 'unfollow',
 *   count: 150,
 * });
 *
 * if (!estimation.canProceed) {
 *   showWarningDialog(estimation.warningMessage);
 * } else if (estimation.requiresConfirmation) {
 *   const confirmed = await showConfirmDialog(estimation);
 *   if (!confirmed) return;
 * }
 *
 * // Proceed with batch operation
 * await performBatchOperation(users, estimation.recommendedBatchSize);
 * ```
 */
export function estimateBatchOperation(config: BatchConfig): BatchEstimation {
  const { operationType, count, delayBetweenOps = 200 } = config;
  const rateLimits = getRateLimitForOperation(operationType);

  // Get current rate limiter state
  const rateLimiter = getGlobalRateLimiter();
  const metrics = rateLimiter.getMetrics(rateLimits.endpointType);
  const availableTokens = metrics?.tokensRemaining ?? 5;

  // Calculate safe limits with safety margin
  const safePerMinute = Math.floor(
    rateLimits.perMinute * BLUESKY_RATE_LIMITS.SAFETY_MARGIN,
  );
  const safePerHour = Math.floor(
    rateLimits.perHour * BLUESKY_RATE_LIMITS.SAFETY_MARGIN,
  );

  // Calculate recommended batch size (50% of per-minute limit for safety)
  const recommendedBatchSize = Math.max(10, Math.floor(safePerMinute * 0.5));

  // Calculate estimated time
  // Time = (count * delay) + (count / perMinute * 60) for rate limit waits
  const baseTimeSeconds = (count * delayBetweenOps) / 1000;
  const rateLimitWaitSeconds = Math.max(
    0,
    ((count - safePerMinute) / safePerMinute) * 60,
  );
  const estimatedTimeSeconds = baseTimeSeconds + rateLimitWaitSeconds;

  // Determine risk level
  const riskLevel = calculateRiskLevel(count, safePerMinute, safePerHour);

  // Determine if operation can proceed
  const canProceed = riskLevel !== "dangerous" || count <= safePerHour;

  // Generate warning and suggestions
  const warningMessage = generateWarningMessage(
    riskLevel,
    count,
    operationType,
  );
  const suggestions = generateSuggestions(
    riskLevel,
    count,
    recommendedBatchSize,
  );

  // Require confirmation for moderate risk and above
  const requiresConfirmation =
    riskLevel !== "safe" || count > recommendedBatchSize;

  return {
    canProceed,
    riskLevel,
    totalOperations: count,
    estimatedTimeSeconds,
    estimatedTimeFormatted: formatDuration(estimatedTimeSeconds),
    recommendedBatchSize,
    availableTokens,
    warningMessage,
    suggestions,
    requiresConfirmation,
  };
}

/**
 * Check if current rate limit state allows batch operation
 *
 * Quick check without full estimation. Useful for enabling/disabling
 * batch operation buttons in the UI.
 *
 * @param operationType - Type of operation to check
 * @param count - Number of operations
 * @returns Whether the operation is likely safe to start
 */
export function canStartBatchOperation(
  operationType: BatchOperationType,
  count: number,
): boolean {
  const rateLimits = getRateLimitForOperation(operationType);
  const safePerMinute = Math.floor(
    rateLimits.perMinute * BLUESKY_RATE_LIMITS.SAFETY_MARGIN,
  );

  // Allow if count is within safe per-minute limit or if it's a small batch
  return count <= safePerMinute || count <= 25;
}

/**
 * Calculate optimal delay between operations to stay within rate limits
 *
 * @param operationType - Type of operation
 * @param batchSize - Number of operations in batch
 * @returns Optimal delay in milliseconds
 */
export function calculateOptimalDelay(
  operationType: BatchOperationType,
  batchSize: number,
): number {
  const rateLimits = getRateLimitForOperation(operationType);
  const safePerMinute = Math.floor(
    rateLimits.perMinute * BLUESKY_RATE_LIMITS.SAFETY_MARGIN,
  );

  // If batch is small enough, use minimum delay
  if (batchSize <= safePerMinute) {
    return 200; // 200ms minimum
  }

  // Calculate delay needed to spread operations over a minute
  // Add some buffer for network latency
  const delayMs = Math.ceil((60 * 1000) / safePerMinute) + 100;

  return Math.max(200, delayMs);
}

/**
 * Get human-readable description of risk level
 */
export function getRiskLevelDescription(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "safe":
      return "This operation is safe and unlikely to hit rate limits.";
    case "moderate":
      return "This operation may take some time but should complete successfully.";
    case "high":
      return "This operation is close to rate limits. Consider smaller batches.";
    case "dangerous":
      return "This operation will likely hit rate limits and may be blocked.";
  }
}

/**
 * Get UI-friendly color for risk level
 */
export function getRiskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "safe":
      return "#22c55e"; // green-500
    case "moderate":
      return "#eab308"; // yellow-500
    case "high":
      return "#f97316"; // orange-500
    case "dangerous":
      return "#ef4444"; // red-500
  }
}
