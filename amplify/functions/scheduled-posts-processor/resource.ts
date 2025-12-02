import { defineFunction } from "@aws-amplify/backend";

export const scheduledPostsProcessor = defineFunction({
  name: "scheduled-posts-processor",
  entry: "./handler.ts",
  environment: {
    // DynamoDB table name will be injected via backend.ts
  },
  timeoutSeconds: 300, // 5 minutes to process batch
  memoryMB: 512,
});
