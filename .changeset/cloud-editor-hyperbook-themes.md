---
"@hyperbook/cloud": patch
---

The editor now uses Hyperbook's own `hyperbook-light`/`hyperbook-dark` syntax themes (`pages/editor/syntax-theme.ts`) instead of the third-party github theme packages, which brought their own editor background along. The rolled-own palette fits Hyperbook's brand (teal/mint accents), works for code files and Markdown pages alike, carries no chrome of its own, and every color is at least 4.5:1 on its background (guarded by a test). The `--hl-*` directive colors in app.css match the new palette. In English and German.
