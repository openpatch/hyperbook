import { defineConfig } from "tsdown";

export default defineConfig(() => ({
  entry: ["src/create-hyperbook.ts"],
  target: "node20",
  format: "cjs",
  minify: true,
  fixedExtension: false,
}));
