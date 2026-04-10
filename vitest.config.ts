import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // jsdom for tests that render React components; pure-logic tests still work.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // Playwright specs live in tests/e2e and must NOT be picked up by vitest.
    exclude: [
      "node_modules/**",
      ".next/**",
      "tests/e2e/**",
      "**/*.spec.ts",
    ],
  },
});
