import { defineFunction, secret } from "@aws-amplify/backend";

export const optimizeThread = defineFunction({
  name: "optimize-thread",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
