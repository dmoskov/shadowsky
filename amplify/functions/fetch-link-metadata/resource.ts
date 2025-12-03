import { defineFunction } from "@aws-amplify/backend";

export const fetchLinkMetadata = defineFunction({
  name: "fetch-link-metadata",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 256,
});
