import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // Like the ".py" text loader of the asset bundles (postbuild.mjs).
      name: "python-source-as-text",
      transform(code, id) {
        if (id.endsWith(".py")) {
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
      },
    },
  ],
});
