---
"hyperbook": minor
"@hyperbook/markdown": patch
---

Add automatic favicon and PWA icon generation from logo

When building a Hyperbook project, if no favicon.ico exists and a logo is defined in hyperbook.json, a complete set of favicons and PWA assets are automatically generated:

- Generates 60+ files including favicon.ico, Android icons, Apple touch icons, and Apple startup images
- Creates web manifest with full PWA metadata (theme color, scope, language, developer info)
- Smart logo path resolution: checks root folder, book folder, and public folder
- Adds favicon, Apple touch icon, and manifest links to all HTML pages
- Uses hyperbook.json metadata: name, description, colors.brand, basePath, language, author
- Backward compatible: copies favicon.ico to root for browsers expecting it there
