---
"@hyperbook/cloud": minor
---

Admins add fonts every book's Typst documents can use under Settings → Typst fonts. Typst ignores the fonts installed on the server, so a document asking for `("Arial", "Liberation Sans")` fell back to Libertinus Serif; upload Liberation Sans there and it is used. The list shows each font's family name, files are added or removed (never replaced), changing them recompiles the documents, and they are part of backups.
