---
"create-hyperbook": patch
"@hyperbook/fs": patch
"hyperbook": patch
"@hyperbook/markdown": patch
"@hyperbook/web-component-excalidraw": patch
"@hyperbook/cloud": patch
"hyperbook-studio": patch
---

Update dependencies across the workspace to their latest versions
(`pnpm update -r --latest`), including @types/node 26.6.6, webpack 5.112.2,
vite ^8.3.5, react ^19.3.1, mermaid 12.2.0, chokidar 6.0.0, sass 1.107.0,
shiki ^4.5.0, struktolab 0.6.3, and many more.

Three upgrades were intentionally kept back:

- TypeScript stays on 6.0.3 (7 is the native port without the JS API the
  code uses); @hyperbook/cloud keeps its existing ^7.0.2.
- @types/vscode stays pinned at 1.125.0 (disabled in renovate.json, and
  @vscode/vsce rejects newer types against engines.vscode ^1.125.0).
- vitest stays on ^4.1.10 outside @hyperbook/cloud (vitest 5 drops `.not`
  from the Assertion type and breaks `tsc --noEmit` on existing tests).

The p5 completions in @hyperbook/markdown were regenerated with
`pnpm p5:completions` for p5 2.3.4. Nothing changes in what a hyperbook
renders.
