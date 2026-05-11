---
"@hyperbook/markdown": patch
---

Fix pytamaro show_graphic not rendering images in pyide output. Parse `@@@PYTAMARO_DATA_URI_BEGIN@@@` / `@@@PYTAMARO_DATA_URI_END@@@` markers in stdout and render them as inline `<img>` elements.
