import { defineFunction, secret } from "@aws-amplify/backend";

export const writingFeedback = defineFunction({
  name: "writing-feedback",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
});
