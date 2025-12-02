import { defineFunction } from "@aws-amplify/backend";

export const ogMetaTags = defineFunction({
  name: "og-meta-tags",
  entry: "./handler.ts",
  timeoutSeconds: 15,
  memoryMB: 256,
});
