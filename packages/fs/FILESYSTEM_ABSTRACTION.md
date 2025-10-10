# Filesystem Abstraction Layer

This document describes the filesystem abstraction layer implemented in the `@hyperbook/fs` package.

## Overview

The `@hyperbook/fs` package now uses an abstraction layer that allows it to work in different environments (Node.js, browser, VS Code Web) by swapping filesystem implementations at runtime.

## Architecture

### Core Interfaces

**FileSystemAdapter** - Interface for all filesystem operations:
- `readFile()`, `writeFile()`, `readdir()`, `stat()`, `exists()` - async operations
- `readFileSync()`, `writeFileSync()`, `existsSync()`, `rmSync()` - sync operations (optional)

**PathAdapter** - Interface for path manipulation:
- `join()`, `resolve()`, `relative()`, `dirname()`, `basename()`, `extname()`, `parse()` 

### Implementations

**Node.js Adapter** (`fs-adapter-node.ts`):
- Uses native Node.js `fs` and `path` modules
- Full support for both sync and async operations
- Used in CLI tools and Desktop VS Code extension

**VS Code Web Adapter** (`fs-adapter-vscode.ts`):
- Uses `vscode.workspace.fs` API for file operations
- Browser-compatible path operations
- Sync operations throw errors (not available in web)
- Currently not fully functional due to dependency issues

## Usage

### Initialization

Before using any `@hyperbook/fs` functions, initialize the appropriate adapters:

```typescript
import {
  setFileSystemAdapter,
  setPathAdapter,
  nodeFileSystemAdapter,
  nodePathAdapter,
} from '@hyperbook/fs';

// For Node.js/Desktop environments
setFileSystemAdapter(nodeFileSystemAdapter);
setPathAdapter(nodePathAdapter);
```

Or for VS Code Web (when fully supported):

```typescript
import {
  setFileSystemAdapter,
  setPathAdapter,
  vscodeFileSystemAdapter,
  vscodePathAdapter,
  setVSCodeWorkspaceFs,
} from '@hyperbook/fs';
import * as vscode from 'vscode';

// For VS Code Web environments
setVSCodeWorkspaceFs(vscode.workspace.fs, vscode.Uri);
setFileSystemAdapter(vscodeFileSystemAdapter);
setPathAdapter(vscodePathAdapter);
```

### In Tests

All tests must initialize adapters in a `beforeAll` hook:

```typescript
import { beforeAll } from 'vitest';
import { setFileSystemAdapter, setPathAdapter } from '@hyperbook/fs';
import { nodeFileSystemAdapter, nodePathAdapter } from '@hyperbook/fs/fs-adapter-node';

beforeAll(() => {
  setFileSystemAdapter(nodeFileSystemAdapter);
  setPathAdapter(nodePathAdapter);
});
```

### In VS Code Extension

The extension automatically initializes the correct adapter based on the runtime environment:

```typescript
import { initializeAdapters } from './adapter-init';

export function activate(context: vscode.ExtensionContext) {
  // Detects environment and initializes appropriate adapters
  initializeAdapters();
  
  // Rest of extension code...
}
```

## Benefits

1. **Environment Agnostic**: Code works in Node.js and (potentially) browser environments
2. **Better Testing**: Easy to mock filesystem operations
3. **Future Proof**: Easy to add new adapter implementations
4. **Clean Architecture**: Filesystem details abstracted away from business logic

## Limitations

- Sync operations not available in web environments (throws errors)
- Some dependencies (find-up, markdown libraries) still use Node.js APIs directly
- Full web support requires replacing these dependencies

## Migration Guide

Existing code doesn't need changes as long as adapters are initialized. The package internally uses:

```typescript
const fs = () => getFileSystemAdapter();
const path = () => getPathAdapter();
```

Instead of direct imports of `fs` and `path`.
