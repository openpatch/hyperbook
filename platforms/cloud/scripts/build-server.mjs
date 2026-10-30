// Bundles the server into dist/server/main.js. Dependencies stay in
// node_modules (better-sqlite3 is native and cannot be bundled).
import { cpSync } from "node:fs";
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/main.ts"],
  outfile: "dist/server/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});

// The AI assistant's read_docs documentation: local markdown the bundle reads
// at runtime (dist/server/main.js resolves ./docs/ to dist/server/docs).
cpSync("src/server/ai/docs", "dist/server/docs", { recursive: true });
