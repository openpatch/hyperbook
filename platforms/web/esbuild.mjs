import chalk from "chalk";
import { buildSync } from "esbuild";
import glob from "glob";
import fs from "fs";
import path from "path";

const files = glob.sync("src/**/*.ts?(x)");

try {
  buildSync({
    entryPoints: files,
    target: "esnext",
    platform: "node",
    outdir: "dist",
    sourcemap: false,
    outbase: ".",
    minify: true,
    bundle: false,
    format: "esm",
  });
} catch (e) {
  throw new Error(`ESM Build failed \n ${e}`);
}

const css = glob.sync("src/**/*.css");

for (const f of css) {
  fs.cpSync(f, path.join("dist", f));
}

console.log(`build ${chalk.green("success")}`);
