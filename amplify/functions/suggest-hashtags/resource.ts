import { defineFunction, secret } from "@aws-amplify/backend";

export const suggestHashtags = defineFunction({
  name: "suggest-hashtags",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
