---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Performance and optimization improvements

- Added `font-display: swap` to all font-face declarations for better page load performance
- Added `defer` attribute to script tags to improve page load speed
- Minified dexie-export-import.js bundle to reduce file size
- Added explicit height attribute to logo image for better CLS scores
