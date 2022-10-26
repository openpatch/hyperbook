const esbuild = require("esbuild");
const plugin = require("node-stdlib-browser/helpers/esbuild/plugin");
const stdLibBrowser = require("node-stdlib-browser");

esbuild
  .build({
    entryPoints: ["./src/extension.ts"],
    bundle: true,
    outfile: "./out/main.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    sourcemap: true,
  })
  .catch(() => process.exit());

esbuild
  .build({
    entryPoints: ["./src/extension.ts"],
    bundle: true,
    outfile: "./out/browser.js",
    inject: [require.resolve("node-stdlib-browser/helpers/esbuild/shim")],
    define: {
      global: "global",
      process: "process",
      Buffer: "Buffer",
    },
    plugins: [plugin(stdLibBrowser)],
    external: ["vscode"],
    format: "cjs",
    platform: "browser",
    sourcemap: true,
  })
  .catch(() => process.exit());
