/**
 * CloudWatch IAM Permission Validation
 *
 * Validates Lambda execution role permissions before performing CloudWatch operations.
 * Implements defense-in-depth by verifying IAM permissions at runtime before API calls.
 *
 * Security Features:
 * - Explicit permission validation for CloudWatch operations
 * - Early failure detection with clear error messages
 * - Permission caching to reduce IAM API calls
 * - Graceful degradation when IAM permissions are insufficient
 */

import { IAMClient, SimulatePrincipalPolicyCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

/**
 * Required CloudWatch permissions for the application
 */
export const REQUIRED_CLOUDWATCH_PERMISSIONS = [
  'cloudwatch:PutMetricData',
  'cloudwatch:GetMetricStatistics',
  'cloudwatch:DescribeAlarms',
] as const;

/**
 * Allowed CloudWatch namespaces that the Lambda can access
 */
export const ALLOWED_CLOUDWATCH_NAMESPACES = [
  'ShadowSky/AnthropicAPI',
  'ShadowSky/Monitoring',
  'ShadowSky/AltTextGeneration',
] as const;

/**
 * Error thrown when IAM permissions are insufficient
 */
export class InsufficientPermissionsError extends Error {
  constructor(
    message: string,
    public readonly missingPermissions: string[],
    public readonly requiredFor: string
  ) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

/**
 * Permission validation result
 */
interface PermissionCheckResult {
  hasPermission: boolean;
  missingPermissions: string[];
  checkedAt: Date;
}

/**
 * In-memory cache for permission checks to reduce IAM API calls
 * Cache TTL: 5 minutes (permissions rarely change during execution)
 */
class PermissionCache {
  private cache: Map<string, PermissionCheckResult> = new Map();
  private readonly ttlMs: number = 5 * 60 * 1000; // 5 minutes

  get(key: string): PermissionCheckResult | undefined {
    const cached = this.cache.get(key);
    if (!cached) {
      return undefined;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.checkedAt.getTime();
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return cached;
  }

  set(key: string, result: PermissionCheckResult): void {
    this.cache.set(key, {
      ...result,
      checkedAt: new Date(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const permissionCache = new PermissionCache();

/**
 * Gets the current Lambda execution role ARN
 */
async function getExecutionRoleArn(): Promise<string> {
  const stsClient = new STSClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const response = await stsClient.send(new GetCallerIdentityCommand({}));
    const arn = response.Arn;

    if (!arn) {
      throw new Error('Unable to determine execution role ARN');
    }

    // Convert assumed role ARN to role ARN
    // Format: arn:aws:sts::ACCOUNT:assumed-role/ROLE_NAME/SESSION
    // Convert to: arn:aws:iam::ACCOUNT:role/ROLE_NAME
    if (arn.includes('assumed-role')) {
      const parts = arn.split('/');
      const roleName = parts[1];
      const accountId = arn.split(':')[4];
      return `arn:aws:iam::${accountId}:role/${roleName}`;
    }

    return arn;
  } catch (error) {
    console.error('Failed to get execution role ARN:', error);
    throw new Error(
      'Unable to determine Lambda execution role. Ensure the Lambda has proper IAM permissions.'
    );
  }
}

/**
 * Validates that the Lambda execution role has required CloudWatch permissions
 *
 * @param permissions - Array of IAM actions to validate (e.g., ['cloudwatch:PutMetricData'])
 * @param resourceArn - Optional specific resource ARN to check (defaults to '*')
 * @returns Promise that resolves if permissions are valid, rejects if insufficient
 */
export async function validateCloudWatchPermissions(
  permissions: readonly string[] = REQUIRED_CLOUDWATCH_PERMISSIONS,
  resourceArn: string = '*'
): Promise<void> {
  // Create cache key
  const cacheKey = `${permissions.join(',')}_${resourceArn}`;

  // Check cache first
  const cached = permissionCache.get(cacheKey);
  if (cached) {
    if (!cached.hasPermission) {
      throw new InsufficientPermissionsError(
        `Lambda execution role lacks required CloudWatch permissions: ${cached.missingPermissions.join(', ')}`,
        cached.missingPermissions,
        'CloudWatch operations'
      );
    }
    return; // Permissions validated from cache
  }

  try {
    // Get the Lambda execution role ARN
    const roleArn = await getExecutionRoleArn();

    // Create IAM client
    const iamClient = new IAMClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    // Simulate policy evaluation
    const command = new SimulatePrincipalPolicyCommand({
      PolicySourceArn: roleArn,
      ActionNames: Array.from(permissions),
      ResourceArns: [resourceArn],
    });

    const response = await iamClient.send(command);

    // Check results
    const missingPermissions: string[] = [];
    for (const result of response.EvaluationResults || []) {
      if (result.EvalDecision !== 'allowed') {
        missingPermissions.push(result.EvalActionName || 'unknown');
      }
    }

    // Cache result
    const checkResult: PermissionCheckResult = {
      hasPermission: missingPermissions.length === 0,
      missingPermissions,
      checkedAt: new Date(),
    };
    permissionCache.set(cacheKey, checkResult);

    // Throw error if permissions are missing
    if (missingPermissions.length > 0) {
      throw new InsufficientPermissionsError(
        `Lambda execution role lacks required CloudWatch permissions: ${missingPermissions.join(', ')}. ` +
          `Please update the Lambda IAM role to include these permissions.`,
        missingPermissions,
        'CloudWatch operations'
      );
    }
  } catch (error) {
    if (error instanceof InsufficientPermissionsError) {
      throw error;
    }

    // If IAM validation itself fails, log warning but don't block
    // This allows the function to work even if IAM:SimulatePrincipalPolicy is not available
    console.warn(
      'Unable to validate CloudWatch permissions via IAM API. ' +
        'Proceeding with CloudWatch operations. If you encounter permission errors, ' +
        'verify the Lambda execution role has the required CloudWatch permissions.',
      error
    );

    // Cache as "has permission" to avoid repeated failures
    permissionCache.set(cacheKey, {
      hasPermission: true,
      missingPermissions: [],
      checkedAt: new Date(),
    });
  }
}

/**
 * Validates that the Lambda can publish metrics to specific CloudWatch namespaces
 *
 * @param namespaces - Array of CloudWatch namespaces to validate
 */
export async function validateNamespaceAccess(
  namespaces: readonly string[] = ALLOWED_CLOUDWATCH_NAMESPACES
): Promise<void> {
  // Validate against allowed namespaces list
  for (const namespace of namespaces) {
    if (!ALLOWED_CLOUDWATCH_NAMESPACES.includes(namespace as any)) {
      throw new InsufficientPermissionsError(
        `Namespace '${namespace}' is not in the allowed list. ` +
          `Allowed namespaces: ${ALLOWED_CLOUDWATCH_NAMESPACES.join(', ')}`,
        [],
        `Access to namespace ${namespace}`
      );
    }
  }

  // Validate CloudWatch permissions
  await validateCloudWatchPermissions(['cloudwatch:PutMetricData']);
}

/**
 * Validates permissions before getting metric statistics
 */
export async function validateMetricStatisticsAccess(): Promise<void> {
  await validateCloudWatchPermissions(['cloudwatch:GetMetricStatistics']);
}

/**
 * Validates permissions before describing alarms
 */
export async function validateAlarmAccess(): Promise<void> {
  await validateCloudWatchPermissions(['cloudwatch:DescribeAlarms']);
}

/**
 * Clears the permission cache (useful for testing or after permission changes)
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
}

/**
 * Formats a user-friendly error message for permission issues
 */
export function formatPermissionError(error: InsufficientPermissionsError): string {
  return (
    `CloudWatch operation blocked: ${error.message}\n\n` +
    `Missing permissions:\n${error.missingPermissions.map(p => `  - ${p}`).join('\n')}\n\n` +
    `Required for: ${error.requiredFor}\n\n` +
    `To fix this issue:\n` +
    `1. Open the AWS Console and navigate to IAM\n` +
    `2. Find the Lambda execution role for this function\n` +
    `3. Attach a policy with the required CloudWatch permissions\n` +
    `4. Redeploy the Lambda function\n\n` +
    `See MONITORING.md for detailed IAM policy examples.`
  );
}
