/**
 * KMS Encryption Configuration for CloudWatch Logs
 *
 * Provides KMS customer-managed keys for encrypting CloudWatch logs
 * containing sensitive user data (user-generated content, image URLs).
 */

import { Key, IKey } from 'aws-cdk-lib/aws-kms';
import { Stack } from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

/**
 * Creates a KMS customer-managed key for CloudWatch logs encryption
 */
export function createCloudWatchLogsKmsKey(stack: Stack): IKey {
  const key = new Key(stack, 'CloudWatchLogsEncryptionKey', {
    alias: 'shadowsky/cloudwatch-logs',
    description: 'KMS key for encrypting CloudWatch logs containing sensitive user data',
    enableKeyRotation: true,
    removalPolicy: RemovalPolicy.RETAIN, // Protect against accidental deletion
  });

  // Grant CloudWatch Logs service permission to use the key
  key.addToResourcePolicy({
    sid: 'Allow CloudWatch Logs to use the key',
    effect: 'Allow' as any,
    principals: [new ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
    actions: [
      'kms:Encrypt',
      'kms:Decrypt',
      'kms:ReEncrypt*',
      'kms:GenerateDataKey*',
      'kms:CreateGrant',
      'kms:DescribeKey',
    ],
    resources: ['*'],
    conditions: {
      ArnLike: {
        'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${stack.region}:${stack.account}:*`,
      },
    },
  });

  return key;
}

/**
 * List of Lambda functions that handle sensitive data
 * requiring KMS encryption for their CloudWatch logs
 */
export const SENSITIVE_LAMBDA_FUNCTIONS = [
  'generate-alt-text',    // Contains: image URLs, alt-text content
  'adjust-tone',          // Contains: user text, tone-adjusted content
  'writing-feedback',     // Contains: user text, corrected/enhanced versions
  'optimize-thread',      // Contains: user thread content, optimized segments
  'suggest-hashtags',     // Contains: user post content
  'style-analysis',       // Contains: current text, historical posts
  'analyze-posts',        // Contains: post text, engagement metrics, user patterns
] as const;

export type SensitiveLambdaFunction = typeof SENSITIVE_LAMBDA_FUNCTIONS[number];

/**
 * Data classification for each Lambda function
 */
export const LAMBDA_DATA_CLASSIFICATION = {
  'generate-alt-text': {
    sensitiveFields: ['imageUrl', 'imageHash', 'altText'],
    dataTypes: ['User-Generated Content', 'Image URLs', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'adjust-tone': {
    sensitiveFields: ['text', 'adjustedText'],
    dataTypes: ['User-Generated Content', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'writing-feedback': {
    sensitiveFields: ['text', 'correctedVersion', 'enhancedVersion'],
    dataTypes: ['User-Generated Content', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'optimize-thread': {
    sensitiveFields: ['text', 'segments'],
    dataTypes: ['User-Generated Content', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'suggest-hashtags': {
    sensitiveFields: ['text'],
    dataTypes: ['User-Generated Content', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'style-analysis': {
    sensitiveFields: ['currentText', 'historicalPosts'],
    dataTypes: ['User-Generated Content', 'User Behavior Patterns', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
  'analyze-posts': {
    sensitiveFields: ['posts', 'text', 'createdAt', 'likes', 'reposts', 'replies'],
    dataTypes: ['User-Generated Content', 'Engagement Metrics', 'User Behavior Patterns', 'PII (potential)'],
    retentionRecommendation: '30 days',
  },
} as const;
