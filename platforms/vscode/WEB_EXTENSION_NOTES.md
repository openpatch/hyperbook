# Web Extension Support - Implementation Notes

## Current Status

The Hyperbook VS Code extension has been partially prepared for web extension support with the following infrastructure in place. **The web build is currently disabled in the default build scripts** to ensure the Node.js extension builds successfully.

### Completed
- ✅ Filesystem abstraction layer in `@hyperbook/fs` package
- ✅ Node.js and VS Code Web filesystem adapters
- ✅ Runtime environment detection in extension
- ✅ Browser-compatible path operations  
- ✅ Webpack configuration for web bundle
- ✅ Package.json configured with `browser` entry point and `extensionKind`

### Building the Extension

**Node.js/Desktop Extension (default):**
```bash
pnpm build              # Builds Node.js extension only
pnpm compile:extension  # Or build just the extension
```

**Web Extension (experimental - will fail):**
```bash
pnpm compile:extension-web  # Attempts web build (currently fails)
```

### Limitations

The following dependencies currently prevent full web extension functionality:

1. **find-up** - Uses Node.js `fs` module directly for finding `hyperbook.json` files
   - Used in `@hyperbook/fs` for `hyperbook.find()` and `hyperlibrary.find()`
   - Would need a web-compatible alternative or VS Code workspace API integration

2. **markdown processing libraries** - Some dependencies use Node.js APIs:
   - `node:crypto` - Used by various markdown plugins
   - `node:fs` - Used for file operations in plugins
   - `node:process`, `node:url` - Used in various dependencies

3. **Synchronous filesystem operations** - Cache functionality uses:
   - `fs.writeFileSync()` - For optional performance caching
   - `fs.rmSync()` - For cache cleanup
   - These throw errors in web environment but are non-critical

## Workarounds Needed for Full Web Support

To achieve full web extension support, the following changes would be required:

1. **Replace find-up** with VS Code workspace search:
   ```typescript
   // Instead of find-up:
   const files = await vscode.workspace.findFiles('**/hyperbook.json');
   ```

2. **Bundle markdown dependencies** with proper polyfills or:
   - Fork/patch dependencies to use web-compatible APIs
   - Create custom builds of dependencies

3. **Remove or stub sync operations**:
   - Make caching fully async
   - Gracefully handle missing sync APIs in web

## Current Recommendation

For now, the extension works perfectly in **Node.js/Desktop VS Code**. Full web support would require significant dependency changes that may not be worth the effort given:
- Most Hyperbook development happens in desktop environments
- File system access is more limited in VS Code Web anyway
- The core functionality (preview, autocomplete, syntax highlighting) could theoretically work in web but file operations are fundamental

## Testing

To test the current Node.js implementation:
1. `cd platforms/vscode && pnpm build`
2. Open VS Code and load the extension
3. Test with a Hyperbook project

The web bundle configuration exists for future reference but is not included in the default build.

