import { defineBackend } from '@aws-amplify/backend';
import { Stack, RemovalPolicy, Duration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { writingFeedback } from './functions/writing-feedback/resource';
import { generateAltText } from './functions/generate-alt-text/resource';
import { adjustTone } from './functions/adjust-tone/resource';
import { optimizeThread } from './functions/optimize-thread/resource';
import { suggestHashtags } from './functions/suggest-hashtags/resource';
import { styleAnalysis } from './functions/style-analysis/resource';
import { analyzePosts } from './functions/analyze-posts/resource';
import { ogMetaTags } from './functions/og-meta-tags/resource';
import { fetchLinkMetadata } from './functions/fetch-link-metadata/resource';
import { scheduledPosts } from './functions/scheduled-posts/resource';
import { scheduledPostsProcessor } from './functions/scheduled-posts-processor/resource';
import { threadSummary } from './functions/thread-summary/resource';
import { createAnthropicDashboard, createAnthropicAlarms } from './functions/shared/cloudwatch-dashboard';
import { createCloudWatchLogsKmsKey } from './functions/shared/kms-encryption';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  writingFeedback,
  generateAltText,
  adjustTone,
  optimizeThread,
  suggestHashtags,
  styleAnalysis,
  analyzePosts,
  ogMetaTags,
  fetchLinkMetadata,
  scheduledPosts,
  scheduledPostsProcessor,
  threadSummary,
});

// Get the main backend stack
const mainStack = backend.stack;

// Create REST API in main stack
const restApi = new RestApi(mainStack, 'RestApi', {
  restApiName: 'shadowsky-api',
  description: 'ShadowSky AI-powered features API',
  deploy: true,
  deployOptions: {
    stageName: 'prod',
  },
  defaultCorsPreflightOptions: {
    allowOrigins: [
      'https://main.shadowsky.io',
      'https://shadowsky.io',
      'https://www.shadowsky.io',
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

// Create Lambda integrations
const writingFeedbackIntegration = new LambdaIntegration(
  backend.writingFeedback.resources.lambda
);
const generateAltTextIntegration = new LambdaIntegration(
  backend.generateAltText.resources.lambda
);
const adjustToneIntegration = new LambdaIntegration(
  backend.adjustTone.resources.lambda
);
const optimizeThreadIntegration = new LambdaIntegration(
  backend.optimizeThread.resources.lambda
);
const suggestHashtagsIntegration = new LambdaIntegration(
  backend.suggestHashtags.resources.lambda
);
const styleAnalysisIntegration = new LambdaIntegration(
  backend.styleAnalysis.resources.lambda
);
const analyzePostsIntegration = new LambdaIntegration(
  backend.analyzePosts.resources.lambda
);
const ogMetaTagsIntegration = new LambdaIntegration(
  backend.ogMetaTags.resources.lambda
);
const scheduledPostsIntegration = new LambdaIntegration(
  backend.scheduledPosts.resources.lambda
);
const fetchLinkMetadataIntegration = new LambdaIntegration(
  backend.fetchLinkMetadata.resources.lambda
);
const threadSummaryIntegration = new LambdaIntegration(
  backend.threadSummary.resources.lambda
);

// Add method options with NONE authorization (no authentication required)
const methodOptions = {
  authorizationType: AuthorizationType.NONE,
};

// Add API routes (OPTIONS methods are automatically handled by CORS configuration)
const writingFeedbackResource = apiResource.addResource('writing-feedback');
writingFeedbackResource.addMethod('POST', writingFeedbackIntegration, methodOptions);

const generateAltTextResource = apiResource.addResource('generate-alt-text');
generateAltTextResource.addMethod('POST', generateAltTextIntegration, methodOptions);

const adjustToneResource = apiResource.addResource('adjust-tone');
adjustToneResource.addMethod('POST', adjustToneIntegration, methodOptions);

const optimizeThreadResource = apiResource.addResource('optimize-thread');
optimizeThreadResource.addMethod('POST', optimizeThreadIntegration, methodOptions);

const suggestHashtagsResource = apiResource.addResource('suggest-hashtags');
suggestHashtagsResource.addMethod('POST', suggestHashtagsIntegration, methodOptions);

const styleAnalysisResource = apiResource.addResource('style-analysis');
styleAnalysisResource.addMethod('POST', styleAnalysisIntegration, methodOptions);

const analyzePostsResource = apiResource.addResource('analyze-posts');
analyzePostsResource.addMethod('POST', analyzePostsIntegration, methodOptions);

const fetchLinkMetadataResource = apiResource.addResource('fetch-link-metadata');
fetchLinkMetadataResource.addMethod('POST', fetchLinkMetadataIntegration, methodOptions);

const threadSummaryResource = apiResource.addResource('thread-summary');
threadSummaryResource.addMethod('POST', threadSummaryIntegration, methodOptions);

// OG Meta Tags endpoints
const ogResource = restApi.root.addResource('og');

// Thread OG: /og/thread/{handle}/{postId}
const ogThreadResource = ogResource.addResource('thread');
const ogThreadHandleResource = ogThreadResource.addResource('{handle}');
const ogThreadPostResource = ogThreadHandleResource.addResource('{postId}');
ogThreadPostResource.addMethod('GET', ogMetaTagsIntegration, methodOptions);

// Profile OG: /og/profile/{handle}
const ogProfileResource = ogResource.addResource('profile');
const ogProfileHandleResource = ogProfileResource.addResource('{handle}');
ogProfileHandleResource.addMethod('GET', ogMetaTagsIntegration, methodOptions);

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

// Create DynamoDB table for alt-text cache
const altTextCacheTable = new Table(mainStack, 'AltTextCache', {
  partitionKey: {
    name: 'imageHash',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  tableName: 'shadowsky-alt-text-cache',
});

// Grant the generate-alt-text Lambda permission to read/write to the cache table
altTextCacheTable.grantReadWriteData(backend.generateAltText.resources.lambda);

// Add table name as environment variable to the Lambda
// Note: AWS_REGION is automatically provided by Lambda runtime
backend.generateAltText.addEnvironment('ALT_TEXT_CACHE_TABLE', altTextCacheTable.tableName);

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

// ============================================================================
// Note: AI features now served by ECS (always-warm server) instead of Lambda
// Lambda functions kept as backup but warmup rules removed since ECS is used
// ============================================================================

// Create CloudWatch Dashboard for Anthropic API monitoring
const monitoringStack = backend.createStack('monitoring-stack');
createAnthropicDashboard(monitoringStack);
createAnthropicAlarms(monitoringStack);

// Create KMS key for CloudWatch logs encryption
const securityStack = backend.createStack('security-stack');
const kmsKey = createCloudWatchLogsKmsKey(securityStack);

// Note: Lambda functions will automatically create their own log groups.
// The KMS key has been configured to allow CloudWatch Logs service to use it,
// so encryption will work automatically for all Lambda log groups.
// Explicit LogGroup creation is not needed and can cause circular dependencies.

// Add custom stack output for the API URL
backend.addOutput({
  custom: {
    API: {
      [restApi.restApiName]: {
        endpoint: restApi.url,
        region: Stack.of(mainStack).region,
        apiName: restApi.restApiName,
      },
    },
  },
});
