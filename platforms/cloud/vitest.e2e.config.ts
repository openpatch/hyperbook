import { defineConfig } from "vitest/config";

// Browser tests against the built server: pnpm build && pnpm test:e2e
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.e2e.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
