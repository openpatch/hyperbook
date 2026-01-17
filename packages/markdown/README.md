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
`:alert`, `:video`, `:youtube`, `:audio`, `:archive`, `:download`, `:embed`, `:excalidraw`, `:mermaid`, `:plantuml`, `:collapsible`, `:tabs`, `:tiles`, `:slideshow`, `:term`, `:pagelist`, `:bookmarks`, `:qr`, `:protect`, `:textinput`, `:pyide`, `:sqlide`, `:webide`, `:onlineide`, `:scratchblock`, `:h5p`, `:geogebra`, `:jsxgraph`, `:abcmusic`, `:learningmap`, `:struktog`, `:typst`, and more.

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
