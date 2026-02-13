import path from "path";
import { cp, readFile, writeFile, mkdir, access } from "fs/promises";
import { minify } from "terser";
import https from "https";
import { Extract } from "unzipper";
import { createWriteStream, createReadStream } from "fs";
import { createHash } from "crypto";

const CACHE_DIR = path.join(".cache", "downloads");

async function getCachedZipPath(url) {
  // Create a filename from the URL hash
  const hash = createHash("sha256").update(url).digest("hex").substring(0, 16);
  const cachePath = path.join(CACHE_DIR, `${hash}.zip`);
  return cachePath;
}

async function isCached(cachePath) {
  try {
    await access(cachePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadZip(url, destination) {
  console.log(`Downloading ${url}...`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadZip(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const fileStream = createWriteStream(destination);
      response.pipe(fileStream);
      
      fileStream.on("finish", () => {
        fileStream.close();
        console.log(`Downloaded to ${destination}`);
        resolve();
      });
      
      fileStream.on("error", reject);
      response.on("error", reject);
    }).on("error", reject);
  });
}

async function extractZip(zipPath, destination) {
  console.log(`Extracting ${zipPath} to ${destination}...`);
  
  return new Promise((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: destination }))
      .on("close", () => {
        console.log(`Extracted to ${destination}`);
        resolve();
      })
      .on("error", reject);
  });
}

async function downloadAndExtractZip(url, destination) {
  const cachePath = await getCachedZipPath(url);
  
  // Ensure cache directory exists
  await mkdir(CACHE_DIR, { recursive: true });
  
  // Check if zip is already cached
  if (await isCached(cachePath)) {
    console.log(`Using cached zip at ${cachePath}`);
  } else {
    // Download to cache
    await downloadZip(url, cachePath);
  }
  
  // Extract from cache
  await extractZip(cachePath, destination);
}

async function postbuild() {
  // Download and extract zips
  const zipFiles = [
    {
      url: "https://github.com/openpatch/sql-ide/releases/download/v2.0.0-hyperbook.2/dist-embedded.zip",
      dst: path.join("./dist", "assets", "directive-sqlide", "include"),
    },
    {
      url: "https://github.com/openpatch/online-ide/releases/download/v2.2.1-hyperbook.2/dist-embedded.zip",
      dst: path.join("./dist", "assets", "directive-onlineide", "include"),
    },
  ];

  for (let zip of zipFiles) {
    await mkdir(zip.dst, { recursive: true });
    await downloadAndExtractZip(zip.url, zip.dst);
  }

  const assets = [
    {
      src: path.join("./node_modules", "dexie", "dist", "dexie.min.js"),
      dst: path.join("./dist", "assets", "dexie.min.js"),
    },
    {
      src: path.join(
        "./node_modules",
        "dexie-export-import",
        "dist",
        "dexie-export-import.js",
      ),
      dst: path.join("./dist", "assets", "dexie-export-import.js"),
      minify: true,
    },
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
        "prod",
        "fonts",
      ),
      dst: path.join("./dist", "assets", "directive-excalidraw", "fonts"),
    },
    {
      src: path.join(
        "./node_modules",
        "@excalidraw",
        "excalidraw",
        "dist",
        "prod",
        "index.css",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-excalidraw",
        "excalidraw.css",
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
      src: path.join("./node_modules", "p5", "lib", "p5.min.js"),
      dst: path.join("./dist", "assets", "directive-p5", "p5.min.js"),
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
      dst: path.join(
        "./dist",
        "assets",
        "directive-abc-music",
        "abcjs-basic-min.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "@webcoder49",
        "code-input",
        "code-input.min.css",
      ),
      dst: path.join("./dist", "assets", "code-input", "code-input.min.css"),
    },
    {
      src: path.join(
        "./node_modules",
        "@webcoder49",
        "code-input",
        "code-input.min.js",
      ),
      dst: path.join("./dist", "assets", "code-input", "code-input.min.js"),
    },
    {
      src: path.join(
        "./node_modules",
        "@webcoder49",
        "code-input",
        "plugins",
        "indent.min.js",
      ),
      dst: path.join("./dist", "assets", "code-input", "indent.min.js"),
    },
    {
      src: path.join(
        "./node_modules",
        "@webcoder49",
        "code-input",
        "plugins",
        "auto-close-brackets.min.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "code-input",
        "auto-close-brackets.min.js",
      ),
    },
    {
      src: path.join("./node_modules", "h5p-standalone", "dist"),
      dst: path.join("./dist", "assets", "directive-h5p"),
    },
    {
      src: path.join("./node_modules", "jsxgraph", "distrib", "jsxgraph.css"),
      dst: path.join("./dist", "assets", "directive-jsxgraph", "jsxgraph.css"),
    },
    {
      src: path.join(
        "./node_modules",
        "jsxgraph",
        "distrib",
        "jsxgraphcore.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-jsxgraph",
        "jsxgraphcore.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "@learningmap",
        "web-component",
        "dist",
        "index.umd.js",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-learningmap",
        "learningmap.umd.js",
      ),
    },
    {
      src: path.join(
        "./node_modules",
        "@learningmap",
        "web-component",
        "dist",
        "web-component.css",
      ),
      dst: path.join(
        "./dist",
        "assets",
        "directive-learningmap",
        "web-component-learningmap.css",
      ),
    },
  ];

  for (let asset of assets) {
    if (asset.minify) {
      const code = await readFile(asset.src, "utf8");
      const result = await minify(code, {
        compress: true,
        mangle: true,
      });
      await writeFile(asset.dst, result.code);
    } else {
      await cp(asset.src, asset.dst, { recursive: true });
    }
  }

  await cp("locales", "./dist/locales", { recursive: true });
}
postbuild();
