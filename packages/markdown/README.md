# @hyperbook/markdown

Markdown processing engine for Hyperbook. This package provides extensive markdown transformation capabilities with 30+ custom directives and plugins:

**Core Features:**
- Custom markdown directives (alerts, videos, collapsibles, tabs, etc.)
- Code execution environments (Python, SQL, Web IDE)
- Interactive elements (Excalidraw, Mermaid, JSXGraph, GeoGebra)
- Media embedding (YouTube, audio, video)
- Math support (KaTeX)
- Syntax highlighting (Shiki with Pretty Code)
- Table of contents generation
- Search document indexing
- Emoji support (GitHub emojis)
- Image processing with attributes

**Supported Directives:**
`:alert`, `:video`, `:youtube`, `:audio`, `:archive`, `:download`, `:embed`, `:excalidraw`, `:mermaid`, `:plantuml`, `:collapsible`, `:tabs`, `:tiles`, `:slideshow`, `:term`, `:pagelist`, `:bookmarks`, `:qr`, `:protect`, `:textinput`, `:pyide`, `:sqlide`, `:webide`, `:onlineide`, `:scratchblock`, `:h5p`, `:geogebra`, `:jsxgraph`, `:abcmusic`, `:learningmap`, `:jmp`, `:struktog`, `:typst`, `:openscad`, and more.

## Installation

```sh
pnpm add @hyperbook/markdown
# or
npm i @hyperbook/markdown
```

## Usage

```typescript
import { process } from "@hyperbook/markdown";

const result = await process({
  content: "# Hello\n\n:alert[Warning]{type=warning}",
  config: hyperbookConfig,
  // ...
});

console.log(result.html); // Transformed HTML
console.log(result.data.headings); // Extracted headings
```

## Browser assets

Browser scripts and styles are included under `dist/assets`. To keep the
package small, it leaves out the large runtimes of these elements and keeps only
their integration scripts and styles:

| Element | Default CDN |
| --- | --- |
| `pyide` | Pyodide on jsDelivr |
| `typst` | Typst packages and fonts on jsDelivr |
| `geogebra` | GeoGebra's server |
| `blockflow` | `blockflow.openpatch.org` |
| `excalidraw` | Excalidraw's own packages on UNPKG |
| `onlineide` | Runtime from `@hyperbook/markdown@0.85.0` on UNPKG |
| `sqlide` | Runtime from `@hyperbook/markdown@0.85.0` on UNPKG |
| `openscad` | Runtime from `@hyperbook/markdown@0.85.0` on UNPKG |

All eight large runtimes are excluded from the npm package. The OpenSCAD,
Online IDE, and SQL IDE default CDNs are pinned to the last published Markdown
release containing them, independently of the current renderer version.
Workspace builds still prepare the full asset tree for publishing CLI bundles.

To serve a missing runtime, choose one of these options:

- **Use the CDN.** Set `elements.<element>.cdn` to `true` in the configuration
  passed to `process`, or to the base URL of your own copy.
- **Download it.** The Hyperbook CLI publishes one verified bundle per element
  for each release. For example, the
  [PyIDE bundle for Hyperbook 0.113.0](https://github.com/openpatch/hyperbook/releases/download/hyperbook-assets-v0.113.0/pyide.tar.gz)
  is listed with its SHA-256 checksum in the
  [CLI asset manifest](https://unpkg.com/hyperbook@0.113.0/dist/asset-manifest.json).
  Extract a bundle into the served assets directory, alongside the other
  `directive-*` folders.

The Hyperbook CLI downloads these bundles automatically. The Hyperbook extension
for VS Code shares the CLI's asset cache and can download them on request.
`AssetManager` from `@hyperbook/fs` implements both.
