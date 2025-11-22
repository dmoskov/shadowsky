import { defineFunction, secret } from "@aws-amplify/backend";

export const generateAltText = defineFunction({
  name: "generate-alt-text",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
    // Note: AWS_REGION is automatically provided by Lambda runtime
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
