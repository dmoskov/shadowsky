import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { writingFeedback } from './functions/writing-feedback/resource';
import { generateAltText } from './functions/generate-alt-text/resource';
import { adjustTone } from './functions/adjust-tone/resource';
import { optimizeThread } from './functions/optimize-thread/resource';
import { suggestHashtags } from './functions/suggest-hashtags/resource';

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
});

// Create a stack for the API
const apiStack = backend.createStack('api-stack');

// Create REST API
const restApi = new RestApi(apiStack, 'RestApi', {
  restApiName: 'shadowsky-api',
  description: 'ShadowSky AI-powered features API',
  deploy: true,
  deployOptions: {
    stageName: 'prod',
  },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'Authorization'],
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

// Add custom stack output for the API URL
backend.addOutput({
  custom: {
    API: {
      [restApi.restApiName]: {
        endpoint: restApi.url,
        region: Stack.of(apiStack).region,
        apiName: restApi.restApiName,
      },
    },
  },
});
