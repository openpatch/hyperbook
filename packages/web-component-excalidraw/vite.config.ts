import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import typescript from "@rollup/plugin-typescript";

export default defineConfig(() => ({
  plugins: [react(), typescript()],
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    lib: {
      formats: ["umd"],
      entry: resolve(__dirname, "src/index.ts"),
      name: "index",
      fileName: (format) => `index.${format}.js`,
    },
  },
  define: {
    "process.env.NODE_ENV": "'production'",
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
}));
