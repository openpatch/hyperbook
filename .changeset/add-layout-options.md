---
"hyperbook": minor
"@hyperbook/markdown": minor
"@hyperbook/types": minor
---

Add page layout options with automatic iframe detection

- Added three layout options: default, wide, and standalone
- Wide layout provides full-width content with drawer-only navigation, ideal for tables, galleries, and code examples
- Standalone layout displays content only (no header, sidebar, footer) for clean iframe embedding
- Standalone mode can be activated via frontmatter (`layout: standalone`), URL parameter (`?standalone=true`), or automatic iframe detection
- Automatically hides TOC toggle and QR code buttons when in standalone mode
- Zero-configuration embedding: pages automatically switch to standalone mode when embedded in iframes
- Added comprehensive documentation in Advanced Features section with usage examples and demos
- All changes are backward compatible with existing pages
