import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "**/tests/e2e/**",
      "**/tests/playwright/**",
      "**/*.spec.ts",
      "**/*.spec.js",
      "**/amplify/**",
      "**/mobile/**",
      // Server tests use node:test (run via `npm test` in server/)
      "**/server/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "src/tests/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData/**",
      ],
      // Coverage thresholds - prevent coverage drops
      // NOTE: Current baseline is ~11% (as of Feb 2026). This is expected for a UI-heavy
      // application where most functionality is tested via E2E tests rather than unit tests.
      // Set to 10% to allow for minor fluctuations while preventing significant drops.
      // TODO: Gradually increase as more unit tests are added.
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bsky/shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
