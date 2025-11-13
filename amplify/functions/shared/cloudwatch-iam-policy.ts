/**
 * CloudWatch Least-Privilege IAM Policy
 *
 * Defines the minimum required IAM permissions for CloudWatch operations.
 * Implements defense-in-depth by restricting access to specific namespaces and actions.
 *
 * Security Principles:
 * - Least privilege: Only grant permissions that are actually needed
 * - Resource restrictions: Limit access to specific CloudWatch namespaces
 * - Action restrictions: Only allow required CloudWatch actions
 * - Condition-based access: Use IAM conditions to further restrict access
 */

import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

/**
 * Creates a least-privilege policy statement for CloudWatch metric publishing
 *
 * Grants only the minimum permissions required to publish metrics:
 * - cloudwatch:PutMetricData for publishing metrics
 *
 * Restrictions:
 * - Restricted to specific namespaces via condition keys
 * - No wildcard namespace access
 * - No access to AWS service namespaces (AWS/*)
 *
 * @param allowedNamespaces - Array of CloudWatch namespaces that the Lambda can publish to
 * @returns PolicyStatement with least-privilege permissions
 */
export function createCloudWatchMetricsPolicy(
  allowedNamespaces: string[] = [
    'ShadowSky/AnthropicAPI',
    'ShadowSky/Monitoring',
    'ShadowSky/AltTextGeneration',
  ]
): PolicyStatement {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cloudwatch:PutMetricData',
    ],
    resources: ['*'], // CloudWatch metrics don't support resource-level permissions
    conditions: {
      StringEquals: {
        // Restrict to specific namespaces only
        'cloudwatch:namespace': allowedNamespaces,
      },
    },
  });
}

/**
 * Creates a least-privilege policy statement for reading CloudWatch metrics
 *
 * Grants permissions to read metric statistics and describe alarms:
 * - cloudwatch:GetMetricStatistics for querying metrics
 * - cloudwatch:DescribeAlarms for checking alarm states
 *
 * Restrictions:
 * - Read-only access (no modifications)
 * - No permission to create, update, or delete alarms
 * - No permission to modify metric data
 *
 * @returns PolicyStatement with least-privilege read permissions
 */
export function createCloudWatchReadPolicy(): PolicyStatement {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cloudwatch:GetMetricStatistics',
      'cloudwatch:DescribeAlarms',
    ],
    resources: ['*'], // CloudWatch metrics don't support resource-level permissions
  });
}

/**
 * Creates a policy statement for IAM permission validation
 *
 * Grants permissions required for runtime IAM permission checks:
 * - sts:GetCallerIdentity to determine the Lambda execution role
 * - iam:SimulatePrincipalPolicy to validate permissions before operations
 *
 * Note: This is optional but recommended for defense-in-depth.
 * If not granted, the Lambda will skip IAM validation and rely on
 * CloudWatch API errors to detect permission issues.
 *
 * @returns PolicyStatement for IAM validation permissions
 */
export function createIAMValidationPolicy(): PolicyStatement {
  return new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'sts:GetCallerIdentity',
      'iam:SimulatePrincipalPolicy',
    ],
    resources: ['*'],
  });
}

/**
 * Creates a complete least-privilege policy for CloudWatch operations
 *
 * Combines all required permissions for CloudWatch monitoring:
 * - Metric publishing (restricted to specific namespaces)
 * - Metric reading (read-only)
 * - IAM validation (optional, for defense-in-depth)
 *
 * @param options - Configuration options
 * @param options.allowedNamespaces - CloudWatch namespaces the Lambda can access
 * @param options.includeReadAccess - Whether to include read permissions (default: true)
 * @param options.includeIAMValidation - Whether to include IAM validation permissions (default: true)
 * @returns Array of PolicyStatements
 */
export function createCloudWatchLeastPrivilegePolicy(options?: {
  allowedNamespaces?: string[];
  includeReadAccess?: boolean;
  includeIAMValidation?: boolean;
}): PolicyStatement[] {
  const {
    allowedNamespaces = [
      'ShadowSky/AnthropicAPI',
      'ShadowSky/Monitoring',
      'ShadowSky/AltTextGeneration',
    ],
    includeReadAccess = true,
    includeIAMValidation = true,
  } = options || {};

  const policies: PolicyStatement[] = [];

  // Always include metrics publishing
  policies.push(createCloudWatchMetricsPolicy(allowedNamespaces));

  // Optionally include read access
  if (includeReadAccess) {
    policies.push(createCloudWatchReadPolicy());
  }

  // Optionally include IAM validation
  if (includeIAMValidation) {
    policies.push(createIAMValidationPolicy());
  }

  return policies;
}

/**
 * Example IAM policy JSON for documentation purposes
 *
 * This can be used as a reference when manually creating IAM policies
 * or for documentation in MONITORING.md
 */
export const EXAMPLE_IAM_POLICY_JSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['cloudwatch:PutMetricData'],
      Resource: '*',
      Condition: {
        StringEquals: {
          'cloudwatch:namespace': [
            'ShadowSky/AnthropicAPI',
            'ShadowSky/Monitoring',
            'ShadowSky/AltTextGeneration',
          ],
        },
      },
    },
    {
      Effect: 'Allow',
      Action: [
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:DescribeAlarms',
      ],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: [
        'sts:GetCallerIdentity',
        'iam:SimulatePrincipalPolicy',
      ],
      Resource: '*',
    },
  ],
};
