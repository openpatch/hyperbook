---
"@hyperbook/types": minor
"@hyperbook/fs": minor
"@hyperbook/markdown": minor
"hyperbook": patch
"hyperbook-studio": minor
---

Keep the Markdown npm package and the VS Code extension small by leaving out large element runtimes.

The Markdown package no longer includes any of the eight large element runtimes; it keeps their integration scripts and styles. With `cdn: true`, Blockflow now loads from `blockflow.openpatch.org` and Excalidraw from its own packages on UNPKG. OpenSCAD, Online IDE and SQL IDE use the published `@hyperbook/markdown@0.85.0` runtimes on UNPKG, independently of the renderer version, so their default CDNs keep working after the runtimes are removed from new packages.

The VS Code extension no longer includes any of the eight large runtimes. Its preview resolves them like a Hyperbook build: elements with a `cdn` setting load from that CDN, and the others use the runtimes in the Hyperbook CLI's asset cache, which the extension now shares. Runtimes that are not downloaded yet load from their default CDN, and the preview offers to download them. The new commands "Download Element Runtimes..." and "Download All Element Runtimes" work like `hyperbook assets fetch` and `hyperbook assets fetch --all`.

`@hyperbook/fs` now provides `AssetManager` and `assetCacheDir`, which the CLI and the VS Code extension share. `@hyperbook/types` exports `elementRuntimeFiles`, the files that show an element's runtime is available locally.

The built Markdown ESM package also supports direct Node imports while remaining compatible with the CLI and extension bundles.
