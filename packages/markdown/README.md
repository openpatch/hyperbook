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

Browser scripts and styles are included under `dist/assets`. Pyodide's large
distribution is provided separately to keep the package within npm's upload
limit. When self-hosting PyIDE with this package, download the
[Pyodide asset bundle for Hyperbook 0.113.0](https://github.com/openpatch/hyperbook/releases/download/hyperbook-assets-v0.113.0/pyide.tar.gz),
verify its SHA-256 checksum against the
[CLI asset manifest](https://unpkg.com/hyperbook@0.113.0/dist/asset-manifest.json),
and extract it into the served assets directory, alongside the other
`directive-*` folders. The bundle includes `directive-pyide/pyodide/` and its
complete Python package distribution.

The Hyperbook CLI downloads this bundle automatically. Hyperbook Studio for
VS Code includes the runtime. Setting `elements.pyide.cdn` to `true` uses the
Pyodide CDN instead of locally served runtime files.
