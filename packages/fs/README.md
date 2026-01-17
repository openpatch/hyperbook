# @hyperbook/fs

File system utilities for Hyperbook projects. This package handles:

- Loading and validating `hyperbook.json` and `hyperlibrary.json` configuration files
- Reading and processing markdown files with frontmatter
- Building navigation structures from file hierarchies
- Managing project structure (hyperbook, hyperlibrary, hyperproject)
- Handling virtual files (VFile) for glossary, archives, snippets, and public assets
- Handlebars template registration and helpers

## Installation

```sh
pnpm add @hyperbook/fs
# or
npm i @hyperbook/fs
```

## Usage

```typescript
import { hyperbook, hyperlibrary, hyperproject } from "@hyperbook/fs";

// Load a hyperbook project
const book = await hyperbook.make("/path/to/book");

// Access configuration
console.log(book.config.name);

// Get navigation
const navigation = book.navigation;
```
