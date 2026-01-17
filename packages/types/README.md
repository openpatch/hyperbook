# @hyperbook/types

TypeScript type definitions for Hyperbook. This package provides all the core types used across the Hyperbook ecosystem, including:

- Configuration types for `hyperbook.json` and `hyperlibrary.json`
- Page and section navigation types
- Language and layout definitions
- Element and directive configuration types
- Glossary and frontmatter types

## Installation

```sh
pnpm add @hyperbook/types
# or
npm i @hyperbook/types
```

## Usage

```typescript
import type { HyperbookJson, Language, Navigation } from "@hyperbook/types";

const config: HyperbookJson = {
  name: "My Documentation",
  language: "en",
  // ...
};
```
