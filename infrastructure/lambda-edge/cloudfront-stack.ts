/**
 * Custom CloudFront Distribution with Lambda@Edge for OG Meta Tags
 *
 * This creates a CloudFront distribution that:
 * 1. Uses the Amplify origin for regular requests
 * 2. Runs Lambda@Edge for crawler detection and OG tag injection
 * 3. Can be associated with a custom domain (shadowsky.io)
 *
 * After deployment:
 * 1. Update DNS to point shadowsky.io to this distribution
 * 2. Or use this distribution's domain for testing first
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface CloudFrontStackProps extends cdk.StackProps {
  lambdaEdgeArn: string;
  amplifyDomain: string;
  customDomain?: string;
  certificateArn?: string;
}

export class OgMetaCloudFrontStack extends cdk.Stack {
  public readonly distributionDomainName: cdk.CfnOutput;
  public readonly distributionId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, {
      ...props,
      // Must be in us-east-1 for Lambda@Edge and ACM certificates
      env: { region: 'us-east-1' },
    });

    // Reference the Lambda@Edge function version
    const edgeFunction = lambda.Version.fromVersionArn(
      this,
      'OgMetaEdgeFunction',
      props.lambdaEdgeArn
    );

    // Create origin for Amplify
    const amplifyOrigin = new origins.HttpOrigin(props.amplifyDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // Configure domain aliases and certificate if provided
    let domainNames: string[] | undefined;
    let certificate: acm.ICertificate | undefined;

    if (props.customDomain && props.certificateArn) {
      domainNames = [props.customDomain, `www.${props.customDomain}`];
      certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );
    }

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'ShadowSky with OG Meta Tags Lambda@Edge',
      domainNames,
      certificate,
      defaultBehavior: {
        origin: amplifyOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
        edgeLambdas: [
          {
            functionVersion: edgeFunction,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          },
        ],
      },
      // Additional behaviors for static assets (bypass Lambda@Edge)
      additionalBehaviors: {
        '/assets/*': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/*.js': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/*.css': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/*.svg': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/*.png': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/*.ico': {
          origin: amplifyOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Outputs
    this.distributionDomainName = new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    this.distributionId = new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'NextSteps', {
      value: props.customDomain
        ? `Update DNS: ${props.customDomain} CNAME ${distribution.distributionDomainName}`
        : `Test at: https://${distribution.distributionDomainName}`,
      description: 'Next steps after deployment',
    });
  }
}

// Standalone deployment
const app = new cdk.App();

// Get configuration from context or use defaults
const lambdaEdgeArn = app.node.tryGetContext('lambdaEdgeArn') ||
  'arn:aws:lambda:us-east-1:181691141781:function:shadowsky-og-meta-edge:1';
const amplifyDomain = app.node.tryGetContext('amplifyDomain') ||
  'd2af16ho3694y4.cloudfront.net';
const customDomain = app.node.tryGetContext('customDomain'); // e.g., 'shadowsky.io'
const certificateArn = app.node.tryGetContext('certificateArn'); // ACM cert ARN in us-east-1

new OgMetaCloudFrontStack(app, 'ShadowSkyCloudFront', {
  lambdaEdgeArn,
  amplifyDomain,
  customDomain,
  certificateArn,
  description: 'Custom CloudFront distribution for ShadowSky with OG meta tags',
});
