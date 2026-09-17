import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Stages the bundled assets once for the whole run — see the file for why
    // per-test-file staging raced.
    globalSetup: ["./tests/global-setup.ts"],
  },
});
