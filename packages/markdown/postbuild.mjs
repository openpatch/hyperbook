import path from "path";
import { cp } from "fs/promises";

async function postbuild() {
  const assets = [
    {
      src: path.join("./node_modules", "mermaid", "dist", "mermaid.min.js"),
      dst: path.join("./dist", "assets", "directive-mermaid", "mermaid.min.js"),
    },
    {
      src: path.join(
        "./node_modules",
        "scratchblocks",
        "build",
        "scratchblocks.min.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-scratchblock",
        "scratchblocks.min.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "scratchblocks",
        "build",
        "translations.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-scratchblock",
        "translations.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "wavesurfer.js",
        "dist",
        "wavesurfer.min.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-audio",
        "wavesurfer.min.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "@excalidraw",
        "excalidraw",
        "dist",
        "excalidraw-assets",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-excalidraw",
        "excalidraw-assets",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "@hyperbook",
        "web-component-excalidraw",
        "dist",
        "index.umd.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-excalidraw",
        "hyperbook-excalidraw.umd.js",
      ),
    },
    {
      src: path.join("./node_modules", "lunr", "lunr.min.js"),
      dst: path.join("./dist", "assets", "lunr.min.js"),
    },
    {
      src: path.join("./node_modules", "lunr-languages", "min"),
      dst: path.join("./dist", "assets", "lunr-languages"),
    },
    {
      src: path.join("./node_modules", "abcjs", "dist", "abcjs-basic-min.js"),
      dst: path.join("./dist", "assets", "directive-abc-music", "abcjs-basic-min.js"),
    }
  ];

  for (let asset of assets) {
    await cp(asset.src, asset.dst, { recursive: true });
  }
}
postbuild();
