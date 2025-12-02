import { defineFunction } from "@aws-amplify/backend";

export const scheduledPosts = defineFunction({
  name: "scheduled-posts",
  entry: "./handler.ts",
  environment: {
    // DynamoDB table name will be injected via backend.ts
  },
  timeoutSeconds: 30,
  memoryMB: 256,
});
