import { defineFunction, secret } from "@aws-amplify/backend";
import { createCloudWatchLeastPrivilegePolicy } from "../shared/cloudwatch-iam-policy";

export const generateAltText = defineFunction({
  name: "generate-alt-text",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
    // AWS_REGION will be set dynamically in backend.ts after resource creation
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});

// Add least-privilege CloudWatch permissions to the Lambda role
// Restricts access to specific namespaces and required actions only
const cloudwatchPolicies = createCloudWatchLeastPrivilegePolicy({
  allowedNamespaces: [
    'ShadowSky/AnthropicAPI',
    'ShadowSky/Monitoring',
    'ShadowSky/AltTextGeneration',
  ],
  includeReadAccess: true,
  includeIAMValidation: true,
});

cloudwatchPolicies.forEach(policy => {
  generateAltText.resources.lambda.addToRolePolicy(policy);
});
