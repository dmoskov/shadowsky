import { defineBackend } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { scheduledPosts } from './functions/scheduled-posts/resource';
import { scheduledPostsProcessor } from './functions/scheduled-posts-processor/resource';

/**
 * ShadowSky Backend Configuration
 *
 * ARCHITECTURE DECISION: ECS vs Lambda
 * =====================================
 *
 * We use ECS (always-warm server) for ALL API features including AI endpoints.
 * Benefits:
 * - No cold starts (critical for AI features that users expect to be instant)
 * - Simpler authentication (no Cognito JWT required, uses Bluesky session)
 * - Single codebase for all API endpoints (server/api-server.js)
 * - Easier local development (same server runs locally)
 *
 * The ONLY exception is scheduled posts, which requires Lambda because:
 * - CloudWatch Events can trigger Lambda functions on a schedule (every minute)
 * - ECS doesn't have native cron support without additional infrastructure
 * - The processor runs briefly every minute - perfect Lambda use case
 * - It's a background job, not user-facing, so cold starts don't matter
 *
 * If you're adding new API endpoints, add them to server/api-server.js, NOT here.
 * Only add Lambda functions here if you need CloudWatch Events triggers.
 *
 * @see https://docs.amplify.aws/react/build-a-backend/
 */
const backend = defineBackend({
  auth,
  data,
  scheduledPosts,
  scheduledPostsProcessor,
});

// Get the main backend stack
const mainStack = backend.stack;

// Create minimal REST API for scheduled posts only
// All other API endpoints are handled by ECS
const restApi = new RestApi(mainStack, 'RestApi', {
  restApiName: 'shadowsky-scheduled-posts-api',
  description: 'ShadowSky scheduled posts API (other features served by ECS)',
  deploy: true,
  deployOptions: {
    stageName: 'prod',
  },
  defaultCorsPreflightOptions: {
    allowOrigins: [
      'https://main.shadowsky.io',
      'https://shadowsky.io',
      'https://www.shadowsky.io',
      'https://asphodel.is',
      'https://www.asphodel.is',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Requested-With',
    ],
    allowCredentials: false,
  },
});

// Create API resource path
const apiResource = restApi.root.addResource('api');

// Scheduled Posts Lambda integration
const scheduledPostsIntegration = new LambdaIntegration(
  backend.scheduledPosts.resources.lambda
);

// Add method options with NONE authorization (no authentication required)
const methodOptions = {
  authorizationType: AuthorizationType.NONE,
};

// Scheduled Posts API: /api/scheduled-posts
const scheduledPostsResource = apiResource.addResource('scheduled-posts');
// GET /api/scheduled-posts - List all scheduled posts
scheduledPostsResource.addMethod('GET', scheduledPostsIntegration, methodOptions);
// POST /api/scheduled-posts - Create a new scheduled post
scheduledPostsResource.addMethod('POST', scheduledPostsIntegration, methodOptions);

// /api/scheduled-posts/time-sync - Get server time for synchronization
const timeSyncResource = scheduledPostsResource.addResource('time-sync');
timeSyncResource.addMethod('GET', scheduledPostsIntegration, methodOptions);

// /api/scheduled-posts/{id} - Individual post operations
const scheduledPostIdResource = scheduledPostsResource.addResource('{id}');
// GET /api/scheduled-posts/{id} - Get a specific scheduled post
scheduledPostIdResource.addMethod('GET', scheduledPostsIntegration, methodOptions);
// PUT /api/scheduled-posts/{id} - Update a scheduled post
scheduledPostIdResource.addMethod('PUT', scheduledPostsIntegration, methodOptions);
// DELETE /api/scheduled-posts/{id} - Delete a scheduled post
scheduledPostIdResource.addMethod('DELETE', scheduledPostsIntegration, methodOptions);

// Create DynamoDB table for scheduled posts
const scheduledPostsTable = new Table(mainStack, 'ScheduledPostsTable', {
  partitionKey: {
    name: 'id',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PAY_PER_REQUEST,
  tableName: 'shadowsky-scheduled-posts',
});

// Add GSI for querying by userDid and scheduledFor
scheduledPostsTable.addGlobalSecondaryIndex({
  indexName: 'userDid-scheduledFor-index',
  partitionKey: {
    name: 'userDid',
    type: AttributeType.STRING,
  },
  sortKey: {
    name: 'scheduledFor',
    type: AttributeType.STRING,
  },
});

// Add GSI for querying by status and scheduledFor (for the processor)
scheduledPostsTable.addGlobalSecondaryIndex({
  indexName: 'status-scheduledFor-index',
  partitionKey: {
    name: 'status',
    type: AttributeType.STRING,
  },
  sortKey: {
    name: 'scheduledFor',
    type: AttributeType.STRING,
  },
});

// Grant read/write permissions to the scheduled posts Lambda
scheduledPostsTable.grantReadWriteData(backend.scheduledPosts.resources.lambda);
scheduledPostsTable.grantReadWriteData(backend.scheduledPostsProcessor.resources.lambda);

// Add table name as environment variable to both Lambdas
backend.scheduledPosts.addEnvironment('SCHEDULED_POSTS_TABLE', scheduledPostsTable.tableName);
backend.scheduledPostsProcessor.addEnvironment('SCHEDULED_POSTS_TABLE', scheduledPostsTable.tableName);

// Create CloudWatch Events rule to trigger the processor every minute
const processorRule = new Rule(mainStack, 'ScheduledPostsProcessorRule', {
  schedule: Schedule.rate(Duration.minutes(1)),
  description: 'Triggers scheduled posts processor every minute',
});

processorRule.addTarget(new LambdaFunction(backend.scheduledPostsProcessor.resources.lambda));

// Output ECS API endpoint for AI features
// Uses api.shadowsky.io which has CloudFront + ACM SSL cert in front of the ALB
backend.addOutput({
  custom: {
    API: {
      'shadowsky-api': {
        endpoint: 'https://api.shadowsky.io',
        region: 'us-west-1',
        apiName: 'shadowsky-api',
      },
    },
  },
});
