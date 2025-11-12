import { defineFunction, secret } from "@aws-amplify/backend";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

export const generateAltText = defineFunction({
  name: "generate-alt-text",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});

// Add CloudWatch metrics permissions to the Lambda role
generateAltText.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['cloudwatch:PutMetricData'],
    resources: ['*'],
  })
);
