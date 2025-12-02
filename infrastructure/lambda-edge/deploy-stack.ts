/**
 * CDK Stack for deploying Lambda@Edge OG Meta Tags function
 *
 * This stack MUST be deployed in us-east-1 (required for Lambda@Edge)
 *
 * After deployment, you need to manually attach the Lambda function version ARN
 * to your Amplify CloudFront distribution's viewer-request event.
 *
 * Usage:
 *   cd infrastructure/lambda-edge
 *   npx cdk deploy --context stackName=shadowsky-og-edge
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class OgMetaEdgeStack extends cdk.Stack {
  public readonly lambdaVersionArn: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      // Lambda@Edge MUST be in us-east-1
      env: { region: 'us-east-1' },
    });

    // Create IAM role with proper trust relationship for Lambda@Edge
    const edgeLambdaRole = new iam.Role(this, 'EdgeLambdaRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('edgelambda.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Create the Lambda@Edge function
    const ogMetaEdge = new lambda.Function(this, 'OgMetaEdgeFunction', {
      functionName: 'shadowsky-og-meta-edge',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'dist')),
      timeout: cdk.Duration.seconds(5), // Lambda@Edge limit for viewer-request
      memorySize: 128, // Lambda@Edge limit for viewer-request
      description: 'Lambda@Edge function for ShadowSky OG meta tag generation',
      role: edgeLambdaRole,
    });

    // Create a version (required for Lambda@Edge)
    const version = ogMetaEdge.currentVersion;

    // Output the version ARN for manual CloudFront configuration
    this.lambdaVersionArn = new cdk.CfnOutput(this, 'LambdaVersionArn', {
      value: version.functionArn,
      description: 'Lambda@Edge Version ARN - Use this in CloudFront viewer-request',
      exportName: 'ShadowSkyOgMetaEdgeLambdaArn',
    });

    // Additional output with instructions
    new cdk.CfnOutput(this, 'Instructions', {
      value: 'Attach this Lambda version to your Amplify CloudFront distribution viewer-request event',
      description: 'Next steps after deployment',
    });
  }
}

// App entry point for standalone deployment
const app = new cdk.App();
new OgMetaEdgeStack(app, 'ShadowSkyOgMetaEdge', {
  description: 'Lambda@Edge for ShadowSky OG meta tag generation',
});
