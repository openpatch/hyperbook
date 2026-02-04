---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix Typst directive issues:
- Fix preview not updating when editor content changes
- Fix UTF-8 encoding for umlauts and special characters in base64 decoding
- Fix CSV/JSON/YAML/XML file loading by inlining assets as bytes with proper UTF-8 handling
- Add assets preamble to all source files to support `#include` with assets
