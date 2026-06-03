import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { defineConfig } from "vitest/config";

// Separate project for the Amplify Lambda functions: Node environment (no DOM),
// run independently of the web suite (which excludes **/amplify/**).
export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    environment: "node",
    globals: true,
    include: ["functions/**/*.test.ts"],
  },
});
