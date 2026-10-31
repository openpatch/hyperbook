import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import typescript from "@rollup/plugin-typescript";

export default defineConfig(() => ({
  plugins: [react(), typescript()],
  resolve: {
    // tunnel-rat (via @excalidraw/excalidraw) imports "react" without
    // declaring it, so with pnpm's strict layout that bare import only
    // resolves when react happens to be hoisted into .pnpm/node_modules.
    // Pin react/react-dom to this package's own copies so the build does
    // not depend on hoisting.
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    lib: {
      formats: ["umd"],
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "index",
      fileName: (format) => `index.${format}.js`,
    },
  },
  define: {
    "process.env.NODE_ENV": "'production'",
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
}));
