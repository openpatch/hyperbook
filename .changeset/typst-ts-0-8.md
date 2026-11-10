---
"hyperbook": minor
"@hyperbook/markdown": minor
"@hyperbook/cloud": minor
---

`:::typst` blocks compile with Typst 0.15.1 (typst.ts 0.8.0-rc4, up from 0.7.0 with Typst 0.14.2), and they can import packages: from Typst Universe as before, and now also the book's own packages (`typst.packagePath`, e.g. `#import "@local/template:1.0.0": *`), shared ones from `HYPERBOOK_TYPST_PACKAGE_PATH`, and on Hyperbook Cloud the instance's packages under Settings → Typst packages. The build packs every package a block imports, and the packages those import, into the site at `/__hyperbook_typst/`; readers' browsers load them from there. A new `packages` attribute offers packages that no file imports yet, for edit mode. A package the book's `exclude` matches stops the build instead of being published.

**Note:** a document that uses something Typst 0.15 removed or changed may need an update. typst.ts 0.8.0 is still a release candidate; it is pinned by checksum.
