import { defineFunction, secret } from "@aws-amplify/backend";

export const threadSummary = defineFunction({
  name: "thread-summary",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
    // WIF migration: once federation rule exists, remove ANTHROPIC_API_KEY and add
    // ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID,
    // ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_WORKSPACE_ID as secrets.
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
