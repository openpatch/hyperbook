// Bundles the server into dist/server/main.js. Dependencies stay in
// node_modules (better-sqlite3 is native and cannot be bundled).
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
