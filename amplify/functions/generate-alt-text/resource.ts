import { defineFunction, secret } from "@aws-amplify/backend";

export const generateAltText = defineFunction({
  name: "generate-alt-text",
  entry: "./handler.ts",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
});
