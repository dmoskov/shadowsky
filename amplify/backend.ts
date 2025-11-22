import { defineBackend } from '@aws-amplify/backend';
import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { writingFeedback } from './functions/writing-feedback/resource';
import { generateAltText } from './functions/generate-alt-text/resource';
import { adjustTone } from './functions/adjust-tone/resource';
import { optimizeThread } from './functions/optimize-thread/resource';
import { suggestHashtags } from './functions/suggest-hashtags/resource';
import { styleAnalysis } from './functions/style-analysis/resource';
import { analyzePosts } from './functions/analyze-posts/resource';
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
    allowOrigins: ['https://main.shadowsky.io', 'https://shadowsky.io', 'http://localhost:5174'],
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
