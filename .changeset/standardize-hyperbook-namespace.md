---
"@hyperbook/markdown": minor
"hyperbook": patch
---

Standardize client-side scripts to use `hyperbook.*` namespace pattern.

- All scripts now use `hyperbook.X = (function() { return {...} })()` IIFE pattern
- Moved `var store` and `var i18n` globals under `hyperbook.store` and `hyperbook.i18n`
- Split `client.js` into `bootstrap.js` (init logic) and `ui.js` (UI functions)
- Grouped UI functions into sub-namespaces: `hyperbook.ui`, `hyperbook.qrcode`, `hyperbook.share`
- All directives now auto-init with `DOMContentLoaded` and `MutationObserver`
- Added JSDoc type definitions via `hyperbook.types.js` for IDE support
- Resolved `hyperbook.download` naming collision (archive directive renamed to `hyperbook.archive`)
